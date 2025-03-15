import { storage } from "@/lib/storage";
import { vectorStore } from "@/lib/vectorStore";
import { generateEmbeddings, generateResponse } from "@/lib/openai";
import { findCategoryMatch } from "@/lib/categoryMapping";
import { detectEntityQuery } from "@/lib/entityDetection";
import { conversationMemory } from "@/lib/conversationMemory";
import { Activity } from "@/shared/schema";

export const runtime = "edge";

// Types for our streaming response
interface StreamChunk {
  id: string;
  type: "sentence" | "partial" | "complete";
  content: string;
  timestamp: number;
  isFinal: boolean;
  metadata?: {
    isListItem?: boolean;
    index?: number;
    totalItems?: number;
    error?: boolean;
  };
}

export async function POST(req: Request) {
  try {
    const { content, user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Make sure vector store is initialized
    if (!vectorStore.isInitialized()) {
      await vectorStore.initialize();
    }

    // Store user message
    await storage.createMessage({
      content,
      role: "user",
      user_id,
    });

    // Get message history and embeddings in parallel
    const [queryEmbeddings, messageHistory] = await Promise.all([
      generateEmbeddings(content),
      storage.getMessages(user_id, { limit: 10 }),
    ]);

    // Initialize relevantData as an empty array
    let relevantData: Activity[] = [];
    let searchMethod = "";

    // STEP 1: Check if this is likely an entity query (specific beach, hotel, etc.)
    if (detectEntityQuery(content)) {
      console.log("Detected entity query, attempting entity search first");
      const entityResults = await vectorStore.findByEntity(content);

      if (entityResults.length > 0) {
        console.log(`Found ${entityResults.length} results via entity search`);
        relevantData = entityResults;
        searchMethod = "entity";
      }
    }

    // STEP 2: If no entity results, try the standard category-based approach
    if (relevantData.length === 0) {
      const { category, subcategory } = findCategoryMatch(content);
      console.log(`Category detection result: ${category}/${subcategory}`);

      const categoryResults = await vectorStore.findSimilar(
        queryEmbeddings,
        category ? 25 : 5, // Increase limit when category is detected
        category,
        subcategory
      );

      if (categoryResults.length > 0) {
        console.log(
          `Found ${categoryResults.length} results via category search`
        );
        relevantData = categoryResults;
        searchMethod = "category";
      }
    }

    // STEP 3: If still no results, try using conversation context
    if (relevantData.length === 0) {
      console.log(
        "No results from standard search methods, trying conversation context"
      );
      const contextData = conversationMemory.getRelatedData(user_id);

      // Try each recent category and subcategory
      if (
        contextData.categories.length > 0 &&
        contextData.subcategories.length > 0
      ) {
        for (const cat of contextData.categories) {
          if (relevantData.length > 0) break;

          for (const subcat of contextData.subcategories) {
            console.log(`Trying context fallback with ${cat}/${subcat}`);
            const contextResults = await vectorStore.findSimilar(
              queryEmbeddings,
              10,
              cat,
              subcat
            );

            if (contextResults.length > 0) {
              console.log(
                `Found ${contextResults.length} results using conversation context`
              );
              relevantData = contextResults;
              searchMethod = "context";
              break;
            }
          }
        }
      }
    }

    // STEP 4: Last resort - pure vector search with lower threshold
    if (relevantData.length === 0) {
      console.log("Falling back to pure vector similarity search");
      const vectorResults = await vectorStore.findSimilar(queryEmbeddings, 10);

      if (vectorResults.length > 0) {
        console.log(
          `Found ${vectorResults.length} results via fallback vector search`
        );
        relevantData = vectorResults;
        searchMethod = "vector";
      }
    }

    // Update conversation memory with results and query
    conversationMemory.update(user_id, content, relevantData);

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    let fullResponse = "";
    let currentSentence = "";
    let chunkId = 0;
    let listItemCount = 0;
    let isInListItem = false;

    // Helper to send a chunk
    const sendChunk = async (chunk: StreamChunk) => {
      await writer.write(encoder.encode(JSON.stringify(chunk) + "\n"));
    };

    // If we have no results at all, let the user know
    if (relevantData.length === 0) {
      const noResultsChunk: StreamChunk = {
        id: `chunk_${Date.now()}_no_results`,
        type: "sentence",
        content:
          "I don't have any specific information about that. Could you provide more details or ask about something else?",
        timestamp: Date.now(),
        isFinal: false,
      };
      await sendChunk(noResultsChunk);

      // Check if we have any previous topics to suggest
      const contextData = conversationMemory.getRelatedData(user_id);
      if (contextData.entities.length > 0 || contextData.topics.length > 0) {
        const suggestionsChunk: StreamChunk = {
          id: `chunk_${Date.now()}_suggestions`,
          type: "sentence",
          content: `You recently asked about ${[
            ...contextData.entities,
            ...contextData.topics,
          ]
            .slice(0, 3)
            .join(", ")}. Would you like to know more about any of these?`,
          timestamp: Date.now(),
          isFinal: false,
        };
        await sendChunk(suggestionsChunk);
      }

      // Send a final completion chunk
      const finalNoResultsChunk: StreamChunk = {
        id: `chunk_${Date.now()}_final`,
        type: "complete",
        content:
          "I don't have any specific information about that. Could you provide more details or ask about something else?",
        timestamp: Date.now(),
        isFinal: true,
      };

      await sendChunk(finalNoResultsChunk);
      await storage.createMessage({
        content: finalNoResultsChunk.content,
        role: "assistant",
        user_id,
      });

      writer.close();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "application/json",
          "Transfer-Encoding": "chunked",
          Connection: "keep-alive",
        },
      });
    }

    // Start streaming response generation
    generateResponse(
      messageHistory.map((m) => ({ role: m.role, content: m.content })),
      relevantData,
      async (chunk) => {
        fullResponse += chunk;
        currentSentence += chunk;

        // Detect list items
        if (chunk.match(/^\d+\.|^\*\*|^•/)) {
          isInListItem = true;
          listItemCount++;
        }

        // Check for sentence endings or list item boundaries
        const shouldSendChunk =
          /[.!?\n]/.test(chunk) || (isInListItem && chunk.includes("\n"));

        if (shouldSendChunk && currentSentence.trim()) {
          const streamChunk: StreamChunk = {
            id: `chunk_${Date.now()}_${chunkId++}`,
            type: "sentence",
            content: currentSentence.trim(),
            timestamp: Date.now(),
            isFinal: false,
            metadata: isInListItem
              ? {
                  isListItem: true,
                  index: listItemCount,
                  totalItems: undefined, // Will be updated in final chunk
                }
              : undefined,
          };

          await sendChunk(streamChunk);
          currentSentence = "";
          isInListItem = false;
        }
      }
    )
      .then(async () => {
        // Send final completion chunk
        const finalChunk: StreamChunk = {
          id: `chunk_${Date.now()}_final`,
          type: "complete",
          content: fullResponse,
          timestamp: Date.now(),
          isFinal: true,
          metadata: {
            totalItems: listItemCount,
          },
        };

        await sendChunk(finalChunk);
        await storage.createMessage({
          content: fullResponse,
          role: "assistant",
          user_id,
        });

        writer.close();
      })
      .catch(async (error) => {
        console.error("Error in streaming response:", error);
        const errorChunk: StreamChunk = {
          id: `chunk_${Date.now()}_error`,
          type: "complete",
          content: "Sorry, an error occurred while generating the response.",
          timestamp: Date.now(),
          isFinal: true,
          metadata: {
            error: true,
          },
        };
        await sendChunk(errorChunk);
        writer.close();
      });

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to stream response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
