import { storage } from "@/lib/storage";
import { vectorStore } from "@/lib/vectorStore";
import { generateEmbeddings, generateResponse } from "@/lib/openai";
import { findCategoryMatch } from "@/lib/categoryMapping";

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

    // Use the existing category mapping function
    const { category, subcategory } = findCategoryMatch(content);
    console.log(`Category detection result: ${category}/${subcategory}`);

    // Find similar activities using the vectorStore's built-in category filtering
    const relevantData = await vectorStore.findSimilar(
      queryEmbeddings,
      category ? 25 : 5, // Increase limit when category is detected
      category,
      subcategory
    );

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
