import { NextResponse } from "next/server";
import { vectorStore } from "../lib/vectorStore";
import { generateEmbeddings } from "../lib/openai";

export async function GET(req: Request) {
  try {
    // Get query param
    const url = new URL(req.url);
    const query = url.searchParams.get("q") || "beach resort in Dubai";

    console.log("Starting vector test with query:", query);

    // Only initialize if needed
    if (!vectorStore.isInitialized()) {
      console.log("Vector store not initialized, initializing now...");
      const startTime = Date.now();
      await vectorStore.initialize();
      console.log(
        `Initialization completed in ${(Date.now() - startTime) / 1000}s`
      );
    } else {
      console.log("Vector store already initialized, skipping initialization");
    }

    // Continue with test
    console.time("total-vector-test");

    // Generate embeddings
    console.time("generate-embeddings");
    const embeddings = await generateEmbeddings(query);
    console.timeEnd("generate-embeddings");

    // Find similar items
    console.time("vector-search");
    const results = await vectorStore.findSimilar(embeddings, 5);
    console.timeEnd("vector-search");

    console.timeEnd("total-vector-test");

    return NextResponse.json({
      query,
      initialized: vectorStore.isInitialized(),
      resultsCount: results.length,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        description: r.description?.substring(0, 100) + "...",
      })),
    });
  } catch (error) {
    console.error("Vector test error:", error);
    return NextResponse.json(
      {
        error: "Failed to test vector search",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
