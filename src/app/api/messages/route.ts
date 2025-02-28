import { NextRequest } from "next/server";
import { insertMessageSchema } from "@/shared/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { messages } from "@/shared/schema";
import { storage } from "../storage";
import { vectorStore } from "../lib/vectorStore";
import { generateResponse, generateEmbeddings } from "../lib/openai";
import { z } from "zod";
import { findCategoryMatch } from "../lib/categoryMapping";
import { sql } from "drizzle-orm";

// Add this to the top of your routes
export const runtime = "edge";

// GET /api/messages - Get messages by user ID
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.user_id, userId))
      .orderBy(messages.timestamp);

    return Response.json(result);
  } catch (error) {
    console.error("Database error:", error);
    return Response.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message and get AI response
export async function POST(req: NextRequest) {
  console.time("total-request");
  try {
    const body = await req.json();

    const { content, user_id } = body || {};

    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    // Time the different stages
    console.time("validate-message");
    // Validate the message structure
    let userMessage;
    try {
      userMessage = insertMessageSchema.parse({
        content,
        role: "user",
        user_id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Response.json(
          { error: "Invalid message format", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }
    console.timeEnd("validate-message");

    // Store user message
    console.time("store-user-message");
    const savedUserMessage = await storage.createMessage(userMessage);
    console.timeEnd("store-user-message");

    // Initialize vector store if needed
    if (!vectorStore.isInitialized()) {
      console.time("vector-store-init");
      await vectorStore.initialize();
      console.timeEnd("vector-store-init");
    }

    // Process in parallel - both embedding generation and message history
    console.time("parallel-processing");
    const [queryEmbeddings, messageHistory] = await Promise.all([
      generateEmbeddings(userMessage.content),
      storage.getMessages(user_id),
    ]);
    console.timeEnd("parallel-processing");

    // ----------------
    // IMPROVED CATEGORY DETECTION - MULTI-STAGE APPROACH
    // ----------------

    let detectedCategory: string | undefined;
    let detectedSubcategory: string | undefined;

    // STAGE 1: Try the predefined mappings first
    const mappingResult = findCategoryMatch(content);
    if (mappingResult.category) {
      console.log(
        `messages: Found match in predefined mappings: ${mappingResult.category}/${mappingResult.subcategory}`
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
      `messages: Final detection: Category=${detectedCategory}, Subcategory=${detectedSubcategory}`
    );

    // Find relevant tourist data with category prioritization
    console.time("find-similar");
    const relevantData = await vectorStore.findSimilar(
      queryEmbeddings,
      detectedCategory ? 25 : 5, // Increase limit to 25 when a category is detected
      detectedCategory || undefined,
      detectedSubcategory || undefined
    );
    console.timeEnd("find-similar");

    // Generate AI response
    console.time("generate-response");
    const aiResponse = await generateResponse(
      messageHistory.map((m) => ({ role: m.role, content: m.content })),
      relevantData
    );
    console.timeEnd("generate-response");

    // Store AI response
    console.time("store-ai-message");
    const savedAiMessage = await storage.createMessage({
      content: aiResponse as string,
      role: "assistant",
      user_id,
    });
    console.timeEnd("store-ai-message");

    console.timeEnd("total-request");
    return Response.json({
      userMessage: savedUserMessage,
      aiMessage: savedAiMessage,
    });
  } catch (error) {
    console.timeEnd("total-request");
    console.error("Error processing message:", error);
    return Response.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// DELETE /api/messages - Delete all messages for a user
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    await db.delete(messages).where(eq(messages.user_id, userId)).execute();
    return Response.json({ message: "Messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return Response.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
