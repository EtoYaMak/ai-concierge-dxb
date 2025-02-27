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
    limit: number = 5
  ): Promise<Activity[]> {
    if (!this.initialized) {
      console.warn("VectorStore: Not initialized");
      return [];
    }

    // Create a cache key from the query embedding (first few dimensions)
    const cacheKey = queryEmbeddings.slice(0, 20).join(",");

    // Check if we have cached results
    if (this.similarityCache.has(cacheKey)) {
      console.log("VectorStore: Using cached similarity results");
      return this.similarityCache.get(cacheKey)!;
    }

    const startTime = performance.now();

    // Log the query being executed
    console.log("Executing vector search query");

    try {
      console.time("format-vector");
      const vectorString = `[${queryEmbeddings.join(",")}]`;
      console.timeEnd("format-vector");

      console.time("db-connection");
      const queryResult = await db.execute(
        sql`
          SELECT *,
          embedding_vector <=> ${vectorString}::vector AS distance
          FROM activities
          ORDER BY embedding_vector <=> ${vectorString}::vector
          LIMIT ${limit}
        `
      );
      console.timeEnd("db-connection");

      const endTime = performance.now();
      console.log(`Vector search completed in ${endTime - startTime}ms`);
      console.log(
        `Found ${queryResult.rows.length} activities via vector search`
      );

      // Extract rows from the query result
      const results = queryResult.rows as (Activity & { distance: number })[];

      // Filter out results with low relevance (high distance)
      // Cosine distance above 0.3 typically indicates low relevance
      const relevantResults = results.filter((r) => r.distance < 0.3);

      // For debugging
      console.log(
        `Vector search found ${results.length} results, filtered to ${relevantResults.length} relevant ones`
      );

      // Cache the filtered results
      this.cacheResults(cacheKey, relevantResults);

      return relevantResults;
    } catch (error) {
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
