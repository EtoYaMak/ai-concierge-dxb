import { db } from "@/lib/db";
import { type Activity } from "@/shared/schema";
import { sql } from "drizzle-orm";

export class VectorStore {
  private initialized = false;
  private cacheSize = 50;
  private similarityCache: Map<string, Activity[]> = new Map();
  private initializationPromise: Promise<boolean> | null = null;

  async initialize(): Promise<boolean> {
    // If already initialized, return immediately
    if (this.initialized) {
      return true;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<boolean> {
    try {
      console.log("Initializing vector store...");
      const countResult = await db.execute(
        sql`SELECT COUNT(*) FROM activities`
      );
      const count = parseInt(countResult.rows[0].count as string, 10);

      this.initialized = count > 0;
      console.log(
        `VectorStore: Initialized with ${count} activities in database`
      );

      return this.initialized;
    } catch (error) {
      console.error("Failed to initialize vector store:", error);
      this.initialized = false;
      return false;
    } finally {
      this.initializationPromise = null;
    }
  }

  async findSimilar(
    queryEmbeddings: number[],
    limit: number = 20,
    category?: string,
    subcategory?: string
  ): Promise<Activity[]> {
    if (!this.initialized) {
      console.warn("VectorStore: Not initialized");
      return [];
    }

    // Create a cache key that includes category/subcategory if provided
    const cacheKey = `${queryEmbeddings.slice(0, 20).join(",")}|cat:${
      category || ""
    }|subcat:${subcategory || ""}`;

    // Check if we have cached results
    if (this.similarityCache.has(cacheKey)) {
      console.log("VectorStore: Using cached similarity results");
      return this.similarityCache.get(cacheKey)!;
    }

    const startTime = performance.now();
    console.log("Executing vector search query with category filtering");

    // Define timerLabel outside the try block so it's available in the catch block
    const timerLabel = `db-connection-${Date.now()}`;

    try {
      console.time("format-vector");
      const vectorString = `[${queryEmbeddings.join(",")}]`;
      console.timeEnd("format-vector");

      console.time(timerLabel);

      // If category and subcategory are provided, prioritize exact matches first
      if (category && subcategory) {
        // First try exact category + subcategory match
        const exactMatches = await db.execute(
          sql`
            SELECT *,
            embedding_vector <=> ${vectorString}::vector AS distance
            FROM activities
            WHERE category = ${category} AND subcategory = ${subcategory}
            ORDER BY embedding_vector <=> ${vectorString}::vector
            LIMIT ${limit * 2}
          `
        );

        // If we have matches, return them without the strict minimum threshold
        if (exactMatches.rows.length > 0) {
          console.log(
            `Found ${exactMatches.rows.length} exact category+subcategory matches`
          );
          const results = exactMatches.rows as (Activity & {
            distance: number;
          })[];
          this.cacheResults(cacheKey, results);
          return results;
        }

        // If not enough exact matches, try category only
        const categoryMatches = await db.execute(
          sql`
            SELECT *,
            embedding_vector <=> ${vectorString}::vector AS distance
            FROM activities
            WHERE category = ${category}
            ORDER BY embedding_vector <=> ${vectorString}::vector
            LIMIT ${limit}
          `
        );

        if (categoryMatches.rows.length > 0) {
          console.log(`Found ${categoryMatches.rows.length} category matches`);
          const results = categoryMatches.rows as (Activity & {
            distance: number;
          })[];
          this.cacheResults(cacheKey, results);
          return results;
        }
      }
      // If only category is provided
      else if (category) {
        try {
          const categoryMatches = await db.execute(
            sql`
              SELECT *
              FROM activities
              WHERE category = ${category}
              ${subcategory ? sql`AND subcategory = ${subcategory}` : sql``}
              LIMIT 50
            `
          );

          if (categoryMatches.rows.length > 0) {
            console.log(
              `Found ${categoryMatches.rows.length} category matches`
            );
            return categoryMatches.rows as Activity[];
          }
        } catch (error) {
          console.error("Error during category search:", error);
        }
      }

      // For subcategory searches, use case-insensitive comparison
      if (subcategory) {
        try {
          console.log(
            `Searching for subcategory: "${subcategory}" in category: "${
              category || "any"
            }"`
          );

          const subcategoryMatches = await db.execute(
            sql`
              SELECT *
              FROM activities
              WHERE LOWER(subcategory) = LOWER(${subcategory})
              ${
                category ? sql`AND LOWER(category) = LOWER(${category})` : sql``
              }
              LIMIT 50
            `
          );

          console.log(
            `Found ${subcategoryMatches.rows.length} subcategory matches`
          );

          if (subcategoryMatches.rows.length > 0) {
            return subcategoryMatches.rows as Activity[];
          }
        } catch (error) {
          console.error("Error during subcategory search:", error);
        }
      }

      // Fall back to standard vector search if no category/subcategory matches or none specified
      const queryResult = await db.execute(
        sql`
          SELECT *,
          embedding_vector <=> ${vectorString}::vector AS distance
          FROM activities
          ORDER BY embedding_vector <=> ${vectorString}::vector
          LIMIT ${limit}
        `
      );
      console.timeEnd(timerLabel);

      const endTime = performance.now();
      console.log(`Vector search completed in ${endTime - startTime}ms`);
      console.log(
        `Found ${queryResult.rows.length} activities via vector search`
      );

      const results = queryResult.rows as (Activity & { distance: number })[];
      const relevantResults = results.filter((r) => r.distance < 0.3);

      console.log(
        `Vector search found ${results.length} results, filtered to ${relevantResults.length} relevant ones`
      );
      this.cacheResults(cacheKey, relevantResults);
      return relevantResults;
    } catch (error) {
      // Now timerLabel is in scope
      console.timeEnd(timerLabel);
      console.error("Vector search error:", error);
      return [];
    }
  }

  private cacheResults(key: string, results: Activity[]) {
    // Manage cache size by removing oldest entries if necessary
    if (this.similarityCache.size >= this.cacheSize) {
      const oldestKey = this.similarityCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.similarityCache.delete(oldestKey);
      }
    }

    this.similarityCache.set(key, results);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setInitialized(value: boolean): void {
    this.initialized = value;
  }
}

// Create a singleton instance
export const vectorStore = new VectorStore();
