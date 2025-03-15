import categoriesJson from "@/assets/all_category_and_subcategory,json.json";

interface CategoryData {
  category: string;
  subcategory: string;
}

// Sets to store extracted category information
const allCategories = new Set<string>();
const allSubcategories = new Set<string>();
const categoryTerms = new Set<string>();
const entityTypes = new Set<string>();

// Common stopwords to filter out
const commonStopwords = new Set([
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
  "been",
  "being",
  "to",
  "of",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "you",
  "your",
  "yours",
]);

// Common entity type words that might appear in categories/subcategories
const commonEntityTypes = [
  "beach",
  "club",
  "hotel",
  "restaurant",
  "bar",
  "lounge",
  "spa",
  "resort",
  "cafe",
  "mall",
  "park",
  "golf",
  "pool",
];

/**
 * Initialize category data from the JSON file
 */
export function initializeCategoryData() {
  try {
    const categories: CategoryData[] = categoriesJson;
    console.log(`Loading ${categories.length} categories from JSON file`);

    // Add common entity types
    commonEntityTypes.forEach((type) => entityTypes.add(type));

    // Process each category
    categories.forEach((item) => {
      const categoryLower = item.category.toLowerCase();
      const subcategoryLower = item.subcategory.toLowerCase();

      allCategories.add(categoryLower);
      allSubcategories.add(subcategoryLower);

      // Add the category itself as a term
      categoryTerms.add(categoryLower);

      // Extract individual words from subcategories
      const subcatWords = subcategoryLower
        .split(/\s+/)
        .filter((word) => word.length > 3 && !commonStopwords.has(word));

      subcatWords.forEach((word) => {
        categoryTerms.add(word);

        // If this looks like an entity type (e.g., "beach", "club"), add it
        if (commonEntityTypes.some((type) => word.includes(type))) {
          entityTypes.add(word);
        }
      });
    });

    console.log(`Initialized with: 
      - ${allCategories.size} categories
      - ${allSubcategories.size} subcategories
      - ${categoryTerms.size} category terms
      - ${entityTypes.size} entity types`);

    return true;
  } catch (error) {
    console.error("Failed to initialize category data:", error);
    return false;
  }
}

/**
 * Detect if a query is asking about a specific entity vs a general category
 */
export function detectEntityQuery(query: string): boolean {
  // Ensure categories are loaded
  if (categoryTerms.size === 0) {
    initializeCategoryData();
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Check for proper nouns (capitalized words not at start of sentence)
  const properNouns = query.match(/(?<!\.\s+|\?\s+|\n\s*)[A-Z][a-z]{2,}/g);

  // Check for entity type patterns (e.g., "X Beach", "Y Hotel")
  const entityTypeRegex = new RegExp(
    `([A-Za-z]+)\\s+(${Array.from(entityTypes).join("|")})`,
    "i"
  );

  // If proper nouns or entity patterns are found, likely an entity query
  if ((properNouns && properNouns.length > 0) || entityTypeRegex.test(query)) {
    return true;
  }

  // Count how many category terms appear in the query
  let categoryTermCount = 0;
  for (const term of categoryTerms) {
    if (normalizedQuery.includes(term)) {
      categoryTermCount++;
    }
  }

  // If very few category terms but specific proper nouns, likely entity query
  if (categoryTermCount <= 1 && properNouns && properNouns.length > 0) {
    return true;
  }

  return false;
}

/**
 * Extract possible entity names from a query
 */
export function extractEntitiesFromQuery(query: string): string[] {
  const entities: string[] = [];

  // Extract proper nouns (capitalized words not at start of sentences)
  const properNouns = query.match(/(?<!\.\s+|\?\s+|\n\s*)[A-Z][a-z]{2,}/g);
  if (properNouns) {
    entities.push(...properNouns);
  }

  // Extract multi-word proper noun phrases
  const properNounPhrases = query.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  );
  if (properNounPhrases) {
    entities.push(...properNounPhrases);
  }

  // Extract terms before entity types (e.g., "Jumeirah Beach")
  const entityTypeArray = Array.from(entityTypes);
  for (const type of entityTypeArray) {
    const regex = new RegExp(`([A-Za-z]+)\\s+${type}`, "gi");
    let match;
    while ((match = regex.exec(query)) !== null) {
      if (match[1] && match[1].length > 2) {
        entities.push(match[1]);
      }
    }
  }

  return [...new Set(entities)]; // Remove duplicates
}

/**
 * Get all entity types extracted from categories
 */
export function getEntityTypes(): string[] {
  // Ensure categories are loaded
  if (entityTypes.size === 0) {
    initializeCategoryData();
  }

  return Array.from(entityTypes);
}

// Initialize on module load
initializeCategoryData();
