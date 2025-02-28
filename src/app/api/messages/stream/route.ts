import { storage } from "../../storage";
import { vectorStore } from "../../lib/vectorStore";
import { generateEmbeddings, generateResponse } from "../../lib/openai";
import { db } from "../../../../lib/db";
import { sql } from "drizzle-orm";
import { findCategoryMatch } from "../../lib/categoryMapping";

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

    // ----------------
    // IMPROVED CATEGORY DETECTION - MULTI-STAGE APPROACH
    // ----------------

    let detectedCategory: string | undefined;
    let detectedSubcategory: string | undefined;

    // STAGE 1: Try the predefined mappings first
    const mappingResult = findCategoryMatch(content);
    if (mappingResult.category) {
      console.log(
        `Found match in predefined mappings: ${mappingResult.category}/${mappingResult.subcategory}`
      );
      detectedCategory = mappingResult.category;
      detectedSubcategory = mappingResult.subcategory;
    }
    // STAGE 2: If no predefined mapping, try direct database matches
    else {
      const lowerContent = content.toLowerCase();

      // Get all unique categories and subcategories
      const [categoriesResult, subcategoriesResult] = await Promise.all([
        db.execute(sql`SELECT DISTINCT category FROM activities`),
        db.execute(
          sql`SELECT DISTINCT category, subcategory FROM activities WHERE subcategory IS NOT NULL`
        ),
      ]);

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

      // STAGE 3: If still no match, try keyword-based matching for common terms
      if (!detectedCategory) {
        console.log("No exact matches found. Trying keyword matching...");

        // Specific keyword patterns to detect
        const keywordPatterns = [
          {
            words: ["adventure"],
            category: "activities",
            subcategory: "adventure",
          },
          { words: ["city"], category: "activities", subcategory: "city" },
          {
            words: ["day", "trips", "outside", "dubai"],
            category: "activities",
            subcategory: "day trips outside dubai",
          },
          { words: ["desert"], category: "activities", subcategory: "desert" },
          {
            words: ["events", "shows"],
            category: "activities",
            subcategory: "events & shows",
          },
          {
            words: ["families", "young", "adults"],
            category: "activities",
            subcategory: "families & young adults",
          },
          { words: ["free"], category: "activities", subcategory: "free" },
          {
            words: ["gifts", "for", "birthdays"],
            category: "activities",
            subcategory: "gifts for birthdays",
          },
          {
            words: ["gifts", "for", "couples", "weddings"],
            category: "activities",
            subcategory: "gifts for couples & weddings",
          },
          {
            words: ["gifts", "for", "friends"],
            category: "activities",
            subcategory: "gifts for friends",
          },
          {
            words: ["gifts", "for", "her"],
            category: "activities",
            subcategory: "gifts for her",
          },
          {
            words: ["gifts", "for", "him"],
            category: "activities",
            subcategory: "gifts for him",
          },
          {
            words: ["gifts", "for", "teenagers"],
            category: "activities",
            subcategory: "gifts for teenagers",
          },
          {
            words: ["must", "do"],
            category: "activities",
            subcategory: "must do",
          },
          {
            words: ["must", "do", "desert", "based"],
            category: "activities",
            subcategory: "must do desert based",
          },
          {
            words: ["must", "do", "premium"],
            category: "activities",
            subcategory: "must do premium",
          },
          {
            words: ["must", "do", "sea", "based"],
            category: "activities",
            subcategory: "must do sea based",
          },
          { words: ["sea"], category: "activities", subcategory: "sea" },
          { words: ["vip"], category: "activities", subcategory: "vip" },
          {
            words: ["all", "you", "can", "eat", "breakfast"],
            category: "dining",
            subcategory: "all you can eat breakfast",
          },
          {
            words: ["all", "you", "can", "eat", "sushi"],
            category: "dining",
            subcategory: "all you can eat sushi",
          },
          {
            words: ["arabic", "casual"],
            category: "dining",
            subcategory: "arabic casual",
          },
          { words: ["baristas"], category: "dining", subcategory: "baristas" },
          {
            words: ["beachfront"],
            category: "dining",
            subcategory: "beachfront",
          },
          {
            words: ["breakfast"],
            category: "dining",
            subcategory: "breakfast",
          },
          {
            words: ["brunch"],
            category: "dining",
            subcategory: "brunch deals",
          },
          { words: ["burgers"], category: "dining", subcategory: "burgers" },
          {
            words: ["business", "lunch"],
            category: "dining",
            subcategory: "business lunch",
          },
          { words: ["cafes"], category: "dining", subcategory: "cafés" },
          { words: ["casual"], category: "dining", subcategory: "casual" },
          {
            words: ["casual", "sushi"],
            category: "dining",
            subcategory: "casual sushi",
          },
          { words: ["chinese"], category: "dining", subcategory: "chinese" },
          { words: ["emirati"], category: "dining", subcategory: "emirati" },
          {
            words: ["family", "friendly", "brunch"],
            category: "dining",
            subcategory: "family friendly brunch",
          },
          { words: ["french"], category: "dining", subcategory: "french" },
          {
            words: ["fully", "redeemable", "pool", "clubs"],
            category: "dining",
            subcategory: "fully redeemable pool clubs",
          },
          { words: ["greek"], category: "dining", subcategory: "greek" },
          { words: ["healthy"], category: "dining", subcategory: "healthy" },
          {
            words: ["hidden", "gems"],
            category: "dining",
            subcategory: "hidden gems",
          },
          { words: ["indian"], category: "dining", subcategory: "indian" },
          { words: ["italian"], category: "dining", subcategory: "italian" },
          { words: ["japanese"], category: "dining", subcategory: "japanese" },
          {
            words: ["japanese", "peruvian"],
            category: "dining",
            subcategory: "japanese-peruvian",
          },
          { words: ["lebanese"], category: "dining", subcategory: "lebanese" },
          {
            words: ["live", "entertainment"],
            category: "dining",
            subcategory: "live entertainment",
          },
          { words: ["new"], category: "dining", subcategory: "new" },
          {
            words: ["night", "brunch"],
            category: "dining",
            subcategory: "night brunch",
          },
          { words: ["outdoor"], category: "dining", subcategory: "outdoor" },
          {
            words: ["outdoor", "lively"],
            category: "dining",
            subcategory: "outdoor & lively",
          },
          {
            words: ["shisha", "hookah"],
            category: "places",
            subcategory: "shisha spots to chill",
          },
          {
            words: ["shisha", "buzz"],
            category: "places",
            subcategory: "shisha spots with a buzz",
          },
          {
            words: ["rooftop", "bar"],
            category: "places",
            subcategory: "rooftop bars & lounges",
          },
          {
            words: ["sundowners"],
            category: "places",
            subcategory: "sundowners",
          },
          {
            words: ["trending", "hot", "spots"],
            category: "trending hot spots",
            subcategory: "dining",
          },
          {
            words: ["jazz", "live", "music", "nights"],
            category: "trending hot spots",
            subcategory: "jazz & live music nights",
          },
          {
            words: ["ladies", "days"],
            category: "trending hot spots",
            subcategory: "ladies days",
          },
          {
            words: ["ladies", "nights"],
            category: "trending hot spots",
            subcategory: "ladies nights",
          },
          {
            words: ["nightlife"],
            category: "trending hot spots",
            subcategory: "nightlife",
          },
        ];

        // Check each pattern against the query
        for (const pattern of keywordPatterns) {
          const allWordsPresent = pattern.words.some((word) =>
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
