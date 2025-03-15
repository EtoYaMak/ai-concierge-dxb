import { Activity } from "@/shared/schema";

interface ConversationContext {
  recentTopics: string[];
  recentEntities: string[];
  lastCategories: Set<string>;
  lastSubcategories: Set<string>;
  lastQueryTime: number;
  lastActivity?: Activity;
}

/**
 * Manages conversation memory to provide context between requests
 */
export class ConversationMemory {
  private memory = new Map<string, ConversationContext>();
  private readonly MAX_MEMORY_SIZE = 50; // Maximum number of users to keep in memory
  private readonly MAX_ITEMS = 5; // Maximum number of topics/entities to remember per user
  private readonly MEMORY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Update memory with new query results
   */
  update(userId: string, query: string, results: Activity[]) {
    this.cleanupExpiredMemory();

    if (!this.memory.has(userId)) {
      this.memory.set(userId, {
        recentTopics: [],
        recentEntities: [],
        lastCategories: new Set(),
        lastSubcategories: new Set(),
        lastQueryTime: Date.now(),
      });
    }

    const userMemory = this.memory.get(userId)!;
    userMemory.lastQueryTime = Date.now();

    // Extract entities and categories from results
    if (results.length > 0) {
      // Update categories and subcategories
      results.forEach((result) => {
        if (result.category) userMemory.lastCategories.add(result.category);
        if (result.subcategory)
          userMemory.lastSubcategories.add(result.subcategory);
      });

      // Remember the most relevant activity
      userMemory.lastActivity = results[0];

      // Update entities (names)
      const entities = results.map((r) => r.name).filter(Boolean) as string[];

      userMemory.recentEntities = [
        ...new Set([...entities, ...userMemory.recentEntities]),
      ].slice(0, this.MAX_ITEMS);
    }

    // Extract topic from query
    const mainTopic = this.extractMainTopic(query);
    if (mainTopic) {
      userMemory.recentTopics = [
        mainTopic,
        ...userMemory.recentTopics.filter((t) => t !== mainTopic),
      ].slice(0, this.MAX_ITEMS);
    }
  }

  /**
   * Get related data for follow-up suggestions
   */
  getRelatedData(userId: string): {
    categories: string[];
    subcategories: string[];
    entities: string[];
    topics: string[];
    lastActivity?: Activity;
  } {
    if (!this.memory.has(userId)) {
      return {
        categories: [],
        subcategories: [],
        entities: [],
        topics: [],
      };
    }

    const userMemory = this.memory.get(userId)!;

    return {
      categories: Array.from(userMemory.lastCategories),
      subcategories: Array.from(userMemory.lastSubcategories),
      entities: userMemory.recentEntities,
      topics: userMemory.recentTopics,
      lastActivity: userMemory.lastActivity,
    };
  }

  /**
   * Extract main topic from a query
   */
  private extractMainTopic(query: string): string | null {
    // Simple extraction of the main subject from the query
    const words = query.toLowerCase().split(/\s+/);

    // Common stopwords to exclude
    const stopwords = new Set([
      "a",
      "an",
      "the",
      "and",
      "or",
      "but",
      "is",
      "are",
      "was",
      "were",
      "to",
      "of",
      "for",
      "with",
      "about",
      "in",
      "on",
      "at",
      "from",
      "me",
      "my",
      "i",
      "we",
      "you",
      "your",
      "their",
      "this",
      "that",
      "these",
      "those",
      "it",
      "its",
      "how",
      "what",
      "when",
      "where",
      "who",
      "why",
      "can",
      "could",
      "would",
      "should",
      "will",
      "shall",
      "may",
      "might",
      "must",
      "need",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "get",
      "got",
      "am",
    ]);

    // Question starters to remove
    const questionStarters = [
      "what",
      "where",
      "how",
      "when",
      "who",
      "why",
      "which",
      "tell",
    ];

    // Filter out stopwords and short words
    let significantWords = words.filter(
      (w) => w.length > 3 && !stopwords.has(w)
    );

    // Remove common question words from the beginning
    if (
      significantWords.length > 0 &&
      questionStarters.includes(significantWords[0])
    ) {
      significantWords.shift();
    }

    // Also look for specific patterns like "tell me about X" or "what is X"
    const aboutMatch = query.match(/(?:about|regarding|concerning)\s+(\w+)/i);
    if (aboutMatch && aboutMatch[1]) {
      return aboutMatch[1].toLowerCase();
    }

    if (significantWords.length > 0) {
      return significantWords[0];
    }

    return null;
  }

  /**
   * Clean up expired memory entries to prevent memory leaks
   */
  private cleanupExpiredMemory() {
    const now = Date.now();

    // Clean up expired entries
    for (const [userId, context] of this.memory.entries()) {
      if (now - context.lastQueryTime > this.MEMORY_EXPIRY_MS) {
        this.memory.delete(userId);
      }
    }

    // If still too many entries, remove oldest
    if (this.memory.size > this.MAX_MEMORY_SIZE) {
      let oldestTime = Date.now();
      let oldestUser = null;

      for (const [userId, context] of this.memory.entries()) {
        if (context.lastQueryTime < oldestTime) {
          oldestTime = context.lastQueryTime;
          oldestUser = userId;
        }
      }

      if (oldestUser) {
        this.memory.delete(oldestUser);
      }
    }
  }
}

// Export singleton instance
export const conversationMemory = new ConversationMemory();
