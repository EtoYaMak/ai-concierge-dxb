import { type Activity } from "@/shared/schema";

export class VectorStore {
  private data: Activity[] = [];

  setData(data: Activity[]) {
    this.data = data;
  }

  async findSimilar(
    queryEmbeddings: number[],
    limit: number = 5
  ): Promise<Activity[]> {
    if (this.data.length === 0) {
      console.warn("VectorStore: No activities data loaded");
      return [];
    }

    // Score all activities based on cosine similarity
    const scored = this.data
      .filter((item) => item.embeddings && item.embeddings.length > 0)
      .map((item) => ({
        item,
        score: this.cosineSimilarity(queryEmbeddings, item.embeddings || []),
      }));

    if (scored.length === 0) {
      console.warn("VectorStore: No activities with valid embeddings found");
      return [];
    }

    // Sort by score and return top matches
    // Increased limit to get more diverse results
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => {
        console.log(`Found match: ${s.item.name} with score ${s.score}`);
        return s.item;
      });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn(
        `VectorStore: Embedding length mismatch: ${a.length} vs ${b.length}`
      );
      return 0;
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      console.warn("VectorStore: Zero magnitude vector encountered");
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Create a singleton instance
export const vectorStore = new VectorStore();
