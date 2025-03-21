import { db } from "@/lib/db";
import { type Activity } from "@/shared/schema";
import { sql } from "drizzle-orm";
import { extractEntitiesFromQuery } from "@/lib/entityDetection";

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

      // If subcategory searches, use LIKE pattern matching instead of exact equality
      if (subcategory) {
        try {
          console.log(
            `Searching for subcategory similar to: "${subcategory}" in category: "${
              category || "any"
            }"`
          );

          const subcategoryMatches = await db.execute(
            sql`
              SELECT *
              FROM activities
              WHERE 
                (LOWER(subcategory) LIKE LOWER(${"%" + subcategory + "%"})
                 OR LOWER(subcategory) SIMILAR TO LOWER(${this.convertToPatternMatch(
                   subcategory
                 )}))
              ${
                category
                  ? sql`AND (LOWER(category) = LOWER(${category}) 
                      OR LOWER(category) LIKE LOWER(${"%" + category + "%"}))`
                  : sql``
              }
              LIMIT 50
            `
          );

          console.log(
            `Found ${subcategoryMatches.rows.length} fuzzy subcategory matches`
          );

          if (subcategoryMatches.rows.length > 0) {
            return subcategoryMatches.rows as Activity[];
          }
        } catch (error) {
          console.error("Error during subcategory fuzzy search:", error);
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

  /**
   * Search for activities by entity name
   * This method extracts potential entity names from the query and searches for them
   * in the name, description, and other relevant fields
   */
  async findByEntity(query: string, limit: number = 10): Promise<Activity[]> {
    if (!this.initialized) {
      console.warn("VectorStore: Not initialized when searching for entity");
      return [];
    }

    // Create a cache key for entity searches
    const cacheKey = `entity:${query}`;

    // Check if we have cached results
    if (this.similarityCache.has(cacheKey)) {
      console.log("VectorStore: Using cached entity search results");
      return this.similarityCache.get(cacheKey)!;
    }

    try {
      console.log(`Searching for entity in query: "${query}"`);
      const startTime = performance.now();

      // Extract potential entity names from the query
      const entities = extractEntitiesFromQuery(query);
      console.log(`Extracted potential entities: ${entities.join(", ")}`);

      if (entities.length === 0) {
        console.log("No entities found in query");
        return [];
      }

      // Build SQL condition for each entity
      const sqlConditions = entities.map((entity) => {
        const escapedEntity = entity.replace(/'/g, "''"); // Escape single quotes
        const pattern = `%${escapedEntity}%`;

        return sql`
          name ILIKE ${pattern} OR 
          description ILIKE ${pattern} OR
          information ILIKE ${pattern}
        `;
      });

      // Combine conditions with OR
      const combinedCondition = sql.join(sqlConditions, sql` OR `);

      // Execute the query
      const result = await db.execute(
        sql`
          SELECT *
          FROM activities
          WHERE ${combinedCondition}
          LIMIT ${limit}
        `
      );

      const endTime = performance.now();
      console.log(`Entity search completed in ${endTime - startTime}ms`);
      console.log(`Found ${result.rows.length} activities by entity search`);

      const activities = result.rows as Activity[];

      // Cache the results
      this.cacheResults(cacheKey, activities);

      return activities;
    } catch (error) {
      console.error("Error during entity search:", error);
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

  // Helper function to convert search terms to pattern matching
  private convertToPatternMatch(term: string): string {
    // Split the term into words
    const words = term.split(/\s+/).filter((w) => w.length > 2);

    // Create patterns that match words in any order
    if (words.length > 1) {
      return "(" + words.map((word) => `%${word}%`).join("|") + ")";
    }
    return `%${term}%`;
  }
}

// Create a singleton instance
export const vectorStore = new VectorStore();
