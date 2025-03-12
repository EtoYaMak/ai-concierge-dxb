import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { findCategoryMatch } from "@/app/api/lib/categoryMapping";

export interface CategoryDetectionResult {
  category?: string;
  subcategory?: string;
}

export class CategoryDetector {
  private keywordPatterns = [
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

  async detectCategory(content: string): Promise<CategoryDetectionResult> {
    let detectedCategory: string | undefined;
    let detectedSubcategory: string | undefined;

    // STAGE 1: Predefined mappings
    const mappingResult = findCategoryMatch(content);
    if (mappingResult.category) {
      console.log(
        `Found match in predefined mappings: ${mappingResult.category}/${mappingResult.subcategory}`
      );
      return mappingResult;
    }

    // STAGE 2: Direct database matches
    const result = await this.checkDatabaseMatches(content);
    if (result.category) {
      return result;
    }

    // STAGE 3: Keyword-based matching
    return this.checkKeywordPatterns(content);
  }

  private async checkDatabaseMatches(
    content: string
  ): Promise<CategoryDetectionResult> {
    const lowerContent = content.toLowerCase();

    // Get all unique categories and subcategories
    const [categoriesResult, subcategoriesResult] = await Promise.all([
      db.execute(sql`SELECT DISTINCT category FROM activities`),
      db.execute(
        sql`SELECT DISTINCT category, subcategory FROM activities WHERE subcategory IS NOT NULL`
      ),
    ]);

    // Try subcategory matches first
    const exactSubcategoryMatches = subcategoriesResult.rows
      .filter((row) => {
        const subcategory = ((row.subcategory as string) || "").toLowerCase();
        return lowerContent.includes(subcategory) && subcategory.length > 3;
      })
      .sort((a, b) => {
        const lenA = ((a.subcategory as string) || "").length;
        const lenB = ((b.subcategory as string) || "").length;
        return lenB - lenA;
      });

    if (exactSubcategoryMatches.length > 0) {
      return {
        category: exactSubcategoryMatches[0].category as string,
        subcategory: exactSubcategoryMatches[0].subcategory as string,
      };
    }

    // Try category matches
    const exactCategoryMatches = categoriesResult.rows
      .filter((row) =>
        lowerContent.includes((row.category as string).toLowerCase())
      )
      .sort((a, b) => {
        const lenA = ((a.category as string) || "").length;
        const lenB = ((b.category as string) || "").length;
        return lenB - lenA;
      });

    if (exactCategoryMatches.length > 0) {
      return {
        category: exactCategoryMatches[0].category as string,
      };
    }

    return {};
  }

  private checkKeywordPatterns(content: string): CategoryDetectionResult {
    const lowerContent = content.toLowerCase();

    for (const pattern of this.keywordPatterns) {
      const allWordsPresent = pattern.words.some((word) =>
        lowerContent.includes(word)
      );

      if (allWordsPresent) {
        console.log(
          `Keyword match found for pattern: ${pattern.words.join(", ")}`
        );
        return {
          category: pattern.category,
          subcategory: pattern.subcategory,
        };
      }
    }

    return {};
  }
}

// Export singleton instance
export const categoryDetector = new CategoryDetector();
