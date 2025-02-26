import { type Activity } from "@/shared/schema";

export class VectorStore {
  private data: Activity[] = [];
  private initialized = false;
  private itemsById: Map<string, Activity> = new Map();

  // Cache for previously computed similarities
  private similarityCache: Map<string, Activity[]> = new Map();
  private cacheSize = 50; // Limit cache size

  setData(data: Activity[]) {
    this.data = data;
    this.initialized = data.length > 0;

    // Create lookup by ID for faster access
    this.itemsById.clear();
    for (const item of data) {
      if (item.id) this.itemsById.set(item.id.toString(), item);
    }

    console.log(`VectorStore: Initialized with ${this.data.length} activities`);
  }

  async findSimilar(
    queryEmbeddings: number[],
    limit: number = 5
  ): Promise<Activity[]> {
    if (!this.initialized || this.data.length === 0) {
      console.warn("VectorStore: No activities data loaded");
      return [];
    }

    // Create a cache key from the query embedding (first few dimensions)
    const cacheKey = queryEmbeddings.slice(0, 20).join(",");

    // Check if we have cached results
    if (this.similarityCache.has(cacheKey)) {
      console.log("VectorStore: Using cached similarity results");
      return this.similarityCache.get(cacheKey)!;
    }

    const startTime = Date.now();

    // Filter out items without embeddings before scoring
    const validItems = this.data.filter(
      (item) => item.embeddings && item.embeddings.length > 0
    );
    if (validItems.length === 0) {
      console.warn("VectorStore: No activities with valid embeddings found");
      return [];
    }

    // Score all activities based on cosine similarity
    const scored = validItems.map((item) => ({
      item,
      score: this.cosineSimilarity(queryEmbeddings, item.embeddings || []),
    }));

    // Sort by score and get top matches
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);

    // Cache the results
    this.cacheResults(cacheKey, results);

    const endTime = Date.now();
    console.log(
      `VectorStore: Found ${results.length} matches in ${endTime - startTime}ms`
    );

    return results;
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

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn(
        `VectorStore: Embedding length mismatch: ${a.length} vs ${b.length}`
      );
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Faster loop implementation
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      console.warn("VectorStore: Zero magnitude vector encountered");
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Create a singleton instance
export const vectorStore = new VectorStore();
