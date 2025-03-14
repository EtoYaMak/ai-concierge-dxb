import { storage } from "@/lib/storage";
import { vectorStore } from "@/lib/vectorStore";
import { generateEmbeddings, generateResponse } from "@/lib/openai";
import { findCategoryMatch } from "@/lib/categoryMapping";

export const runtime = "edge";

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

    // Start streaming response generation
    generateResponse(
      messageHistory.map((m) => ({ role: m.role, content: m.content })),
      relevantData,
      async (chunk) => {
        fullResponse += chunk;
        await writer.write(encoder.encode(chunk));
      }
    )
      .then(async () => {
        // Store the complete response when done
        await storage.createMessage({
          content: fullResponse,
          role: "assistant",
          user_id,
        });

        writer.close();
      })
      .catch(async (error) => {
        console.error("Error in streaming response:", error);
        await writer.write(
          encoder.encode(
            "\n\nSorry, an error occurred while generating the response."
          )
        );
        writer.close();
      });

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
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
