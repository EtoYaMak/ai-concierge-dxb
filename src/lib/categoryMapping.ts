interface CategoryMap {
  [key: string]: {
    category: string;
    subcategory?: string;
  };
}

// Map common user terms to official category/subcategory pairs
export const categoryMappings: CategoryMap = {
  // Activities
  adventure: { category: "activities", subcategory: "adventure" },
  city: { category: "activities", subcategory: "city" },
  "day trips": {
    category: "activities",
    subcategory: "day trips outside dubai",
  },
  desert: { category: "activities", subcategory: "desert" },
  "events & shows": { category: "activities", subcategory: "events & shows" },
  "family activities": {
    category: "activities",
    subcategory: "families & young adults",
  },
  "free activities": { category: "activities", subcategory: "free" },
  "gifts birthdays": {
    category: "activities",
    subcategory: "gifts for birthdays",
  },
  "gifts couples": {
    category: "activities",
    subcategory: "gifts for couples & weddings",
  },
  "gifts friends": { category: "activities", subcategory: "gifts for friends" },
  "gifts her": { category: "activities", subcategory: "gifts for her" },
  "gifts him": { category: "activities", subcategory: "gifts for him" },
  "gifts teenagers": {
    category: "activities",
    subcategory: "gifts for teenagers",
  },
  "must do": { category: "activities", subcategory: "must do" },
  "must do desert": {
    category: "activities",
    subcategory: "must do desert based",
  },
  "must do premium": { category: "activities", subcategory: "must do premium" },
  "must do sea": { category: "activities", subcategory: "must do sea based" },
  sea: { category: "activities", subcategory: "sea" },
  vip: { category: "activities", subcategory: "vip" },

  // Dining
  "all you can eat breakfast": {
    category: "dining",
    subcategory: "all you can eat breakfast",
  },
  "all you can eat sushi": {
    category: "dining",
    subcategory: "all you can eat sushi",
  },
  "arabic casual": { category: "dining", subcategory: "arabic casual" },
  baristas: { category: "dining", subcategory: "baristas" },
  beachfront: { category: "dining", subcategory: "beachfront" },
  breakfast: { category: "dining", subcategory: "breakfast" },
  brunch: { category: "dining", subcategory: "brunch deals" },
  burgers: { category: "dining", subcategory: "burgers" },
  "business lunch": { category: "dining", subcategory: "business lunch" },
  "casual dining": { category: "dining", subcategory: "casual" },
  "casual sushi": { category: "dining", subcategory: "casual sushi" },
  chinese: { category: "dining", subcategory: "chinese" },
  emirati: { category: "dining", subcategory: "emirati" },
  "family friendly brunch": {
    category: "dining",
    subcategory: "family friendly brunch",
  },
  french: { category: "dining", subcategory: "french" },
  "greek food": { category: "dining", subcategory: "greek" },
  healthy: { category: "dining", subcategory: "healthy" },
  "hidden gems": { category: "dining", subcategory: "hidden gems" },
  indian: { category: "dining", subcategory: "indian" },
  "italian food": { category: "dining", subcategory: "italian" },
  japanese: { category: "dining", subcategory: "japanese" },
  "japanese-peruvian": { category: "dining", subcategory: "japanese-peruvian" },
  lebanese: { category: "dining", subcategory: "lebanese" },
  "live entertainment dining": {
    category: "dining",
    subcategory: "live entertainment",
  },
  "night brunch": { category: "dining", subcategory: "night brunch" },
  "outdoor dining": { category: "dining", subcategory: "outdoor" },
  "pan asian": { category: "dining", subcategory: "pan asian" },
  "persian food": { category: "dining", subcategory: "persian" },
  "pizza casual": { category: "dining", subcategory: "pizza casual" },
  romantic: { category: "dining", subcategory: "romantic" },
  "seafood restaurants": { category: "dining", subcategory: "seafood" },
  "steak houses": { category: "dining", subcategory: "steak" },
  "turkish food": { category: "dining", subcategory: "turkish" },
  unique: { category: "dining", subcategory: "unique" },
  upscale: { category: "dining", subcategory: "upscale" },
  "value casual": { category: "dining", subcategory: "value casual" },

  // Hotels
  "3 star hotels": { category: "hotels", subcategory: "3 star hotels" },
  "4 star hotels": { category: "hotels", subcategory: "4 star hotels" },
  "5 star hotels": { category: "hotels", subcategory: "5 star hotels" },
  "6 star hotels": { category: "hotels", subcategory: "6 star hotels" },
  "7 star hotels": { category: "hotels", subcategory: "7 star hotels" },
  "beach resorts": { category: "hotels", subcategory: "beach resorts" },
  "luxury hotels": { category: "hotels", subcategory: "luxury city hotels" },
  "party hotels": { category: "hotels", subcategory: "party hotels" },

  // Places
  shisha: { category: "places", subcategory: "shisha spots to chill" },
  "shisha lounge": { category: "places", subcategory: "shisha spots to chill" },
  "shisha bar": { category: "places", subcategory: "shisha spots to chill" },
  "shisha cafe": { category: "places", subcategory: "shisha spots to chill" },
  "shisha club": { category: "places", subcategory: "shisha spots to chill" },
  "shisha buzz": { category: "places", subcategory: "shisha spots with buzz" },
  "shisha chill": { category: "places", subcategory: "shisha spots to chill" },
  beach: { category: "places", subcategory: "beach clubs to chill" },
  "party beach": { category: "places", subcategory: "beach clubs to party" },
  pool: { category: "places", subcategory: "pool clubs to chill" },
  "party pool": { category: "places", subcategory: "pool clubs to party" },
  lounge: { category: "places", subcategory: "indoor bars & lounges" },
  rooftop: { category: "places", subcategory: "rooftop bars & lounges" },

  // Trending Hot Spots
  "ladies night": {
    category: "trending hot spots",
    subcategory: "ladies nights",
  },
  "nightlife spots": {
    category: "trending hot spots",
    subcategory: "nightlife",
  },
};

// Function to find closest category match from user input
export function findCategoryMatch(userInput: string): {
  category?: string;
  subcategory?: string;
} {
  // Normalize input and extract individual words
  const normalizedInput = userInput.toLowerCase().trim();
  // Split the input into individual words and filter out common stop words
  const stopWords = new Set([
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
    "be",
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
    "i",
    "me",
    "my",
    "myself",
    "we",
    "our",
    "ours",
    "ourselves",
    "you",
    "your",
    "yours",
    "yourself",
    "yourselves",
    "he",
    "him",
    "his",
    "himself",
    "she",
    "her",
    "hers",
    "herself",
    "it",
    "its",
    "itself",
    "they",
    "them",
    "their",
    "theirs",
    "themselves",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "am",
    "have",
    "has",
    "had",
    "having",
    "do",
    "does",
    "did",
    "doing",
    "would",
    "should",
    "could",
    "ought",
    "i'm",
    "you're",
    "he's",
    "she's",
    "it's",
    "we're",
    "they're",
    "i've",
    "you've",
    "we've",
    "they've",
    "i'd",
    "you'd",
    "he'd",
    "she'd",
    "we'd",
    "they'd",
    "i'll",
    "you'll",
    "he'll",
    "she'll",
    "we'll",
    "they'll",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "hasn't",
    "haven't",
    "hadn't",
    "doesn't",
    "don't",
    "didn't",
    "won't",
    "wouldn't",
    "shan't",
    "shouldn't",
    "can't",
    "cannot",
    "couldn't",
    "mustn't",
    "let's",
    "that's",
    "who's",
    "what's",
    "here's",
    "there's",
    "when's",
    "where's",
    "why's",
    "how's",
    "looking",
    "want",
    "like",
    "need",
    "get",
    "find",
    "going",
    "go",
  ]);

  // Extract meaningful words from input (3+ characters, not in stopwords)
  const inputWords = normalizedInput
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  console.log(`Extracted keywords from input: ${inputWords.join(", ")}`);

  // STEP 1: Find all possible matching categories
  // Instead of just checking if the input contains a key, consider all categories
  // and calculate a relevance score for each
  const allCandidates = [];

  for (const [key, value] of Object.entries(categoryMappings)) {
    // Calculate base score: does the exact key match appear in the input?
    let baseScore = normalizedInput.includes(key) ? 3 : 0;

    // If we already have an exact match, add it
    if (baseScore > 0) {
      allCandidates.push({
        key,
        baseScore,
        subcategoryScore: 0,
        totalScore: baseScore,
        match: value,
      });
      continue;
    }

    // If no exact key match, check individual words
    const keyWords = key
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // How many of the key words appear in the input?
    const matchingKeyWords = keyWords.filter((word) =>
      normalizedInput.includes(word)
    );
    if (matchingKeyWords.length > 0) {
      // If all words in the key match, higher score; partial matches get lower score
      baseScore = matchingKeyWords.length === keyWords.length ? 2 : 1;

      allCandidates.push({
        key,
        baseScore,
        subcategoryScore: 0,
        totalScore: baseScore,
        match: value,
      });
    }
  }

  // No matches found at all
  if (allCandidates.length === 0) {
    return {};
  }

  // STEP 2: For all candidates, calculate subcategory relevance score
  for (const candidate of allCandidates) {
    if (!candidate.match.subcategory) continue;

    const subcategory = candidate.match.subcategory.toLowerCase();

    // First check if any input words appear in subcategory
    let subcategoryScore = 0;

    // Get words from subcategory, excluding stopwords
    const subcategoryWords = subcategory
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // For each meaningful input word
    for (const inputWord of inputWords) {
      // Higher score if input word appears in subcategory
      if (subcategoryWords.includes(inputWord)) {
        subcategoryScore += 2;
      }
      // Still give some score if the word is contained within subcategory
      else if (subcategory.includes(inputWord)) {
        subcategoryScore += 1;
      }
    }

    // Update candidate scores
    candidate.subcategoryScore = subcategoryScore;
    candidate.totalScore = candidate.baseScore + subcategoryScore;
  }

  // STEP 3: Sort and select the best match
  // Sort by total score (desc), then by specificity (key length)
  allCandidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return b.key.length - a.key.length;
  });

  // Log all candidates with their scores for debugging
  console.log("ALL potential matches (sorted by relevance):");
  allCandidates.forEach((c) => {
    console.log(
      `- "${c.key}" → ${c.match.category}/${c.match.subcategory} (total: ${c.totalScore}, base: ${c.baseScore}, subcategory: ${c.subcategoryScore})`
    );
  });

  console.log(
    `Best match: ${allCandidates[0].match.category}/${allCandidates[0].match.subcategory} (score: ${allCandidates[0].totalScore})`
  );

  // Return the highest scoring match
  return allCandidates[0].match;
}
