import { storage } from "../../storage";
import { vectorStore } from "../../lib/vectorStore";
import { generateEmbeddings, generateResponse } from "../../lib/openai";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";

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

    // Extract potential category and subcategory dynamically
    const lowerContent = content.toLowerCase();

    // Get all unique categories and subcategories
    const [categoriesResult, subcategoriesResult] = await Promise.all([
      db.execute(sql`SELECT DISTINCT category FROM activities`),
      db.execute(
        sql`SELECT DISTINCT category, subcategory FROM activities WHERE subcategory IS NOT NULL`
      ),
    ]);

    // Reset detection for each new request
    let detectedCategory: string | undefined;
    let detectedSubcategory: string | undefined;

    // --- STEP 1: Direct content matching for exact phrases ---
    // Try to find exact subcategory matches first
    const exactSubcategoryMatches = subcategoriesResult.rows.filter((row) => {
      const subcategory = ((row.subcategory as string) || "").toLowerCase();
      return lowerContent.includes(subcategory) && subcategory.length > 3;
    });

    // Sort by length (longest match first)
    exactSubcategoryMatches.sort((a, b) => {
      const lenA = ((a.subcategory as string) || "").length;
      const lenB = ((b.subcategory as string) || "").length;
      return lenB - lenA; // Descending order - longest first
    });

    // Debug the potential matches
    console.log(
      "Potential subcategory matches:",
      exactSubcategoryMatches.map(
        (m) =>
          `${m.category}/${m.subcategory} (${(m.subcategory as string).length})`
      )
    );

    // Take the longest matching subcategory
    if (exactSubcategoryMatches.length > 0) {
      detectedCategory = exactSubcategoryMatches[0].category as string;
      detectedSubcategory = exactSubcategoryMatches[0].subcategory as string;
      console.log(
        `Selected best subcategory match: ${detectedSubcategory} in ${detectedCategory}`
      );
    } else {
      // If no subcategory, try exact category matches
      const exactCategoryMatches = categoriesResult.rows.filter((row) => {
        return lowerContent.includes((row.category as string).toLowerCase());
      });

      // Sort by length (longest match first)
      exactCategoryMatches.sort((a, b) => {
        const lenA = ((a.category as string) || "").length;
        const lenB = ((b.category as string) || "").length;
        return lenB - lenA;
      });

      if (exactCategoryMatches.length > 0) {
        detectedCategory = exactCategoryMatches[0].category as string;
        console.log(`Selected best category match: ${detectedCategory}`);
      }
    }

    // --- STEP 2: Keyword-based matching for common terms ---
    // If no exact matches found, try keyword-based matching
    if (!detectedCategory && !detectedSubcategory) {
      console.log("No exact matches found. Trying keyword matching...");

      // Specific keyword patterns to detect
      const keywordPatterns = [
        {
          words: ["hotel", "spa"],
          category: "places",
          subcategory: "city hotel spas",
        },
        { words: ["spa"], category: "places", subcategory: "city hotel spas" },
        {
          words: ["beach", "club"],
          category: "places",
          subcategory: "beach clubs to chill",
        },
        // Add more patterns as needed
      ];

      // Check each pattern against the query
      for (const pattern of keywordPatterns) {
        const allWordsPresent = pattern.words.every((word) =>
          lowerContent.includes(word)
        );

        if (allWordsPresent) {
          console.log(
            `Keyword match found for pattern: ${pattern.words.join(", ")}`
          );
          detectedCategory = pattern.category;
          detectedSubcategory = pattern.subcategory;
          break;
        }
      }
    }

    console.log(
      `Final detection: Category=${detectedCategory}, Subcategory=${detectedSubcategory}`
    );

    // Find similar activities with category prioritization
    const relevantData = await vectorStore.findSimilar(
      queryEmbeddings,
      detectedCategory ? 25 : 5, // Increase limit to 25 when a category is detected
      detectedCategory || undefined,
      detectedSubcategory || undefined
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
