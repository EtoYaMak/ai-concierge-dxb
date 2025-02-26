import OpenAI from "openai";
import { type Activity } from "@/shared/schema";
import NodeCache from "node-cache";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const CHAT_MODEL = "gpt-4o";

const responseCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour cache
const embeddingCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 }); // 24 hour cache

export async function generateResponse(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  relevantData: Activity[]
): Promise<string> {
  // Create a cache key from the last user message and relevant data IDs
  const lastUserMessage =
    messages.filter((m) => m.role === "user").pop()?.content || "";
  const dataIds = relevantData
    .map((d) => d.id || d.originalId || d.name)
    .join(",");

  const cacheKey = `response:${lastUserMessage}:${dataIds}`.substring(0, 100);

  // Check if we have this response cached
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse) {
    console.log("Using cached AI response");
    return cachedResponse as string;
  }

  // Add identity and personality to the AI
  const baseSystemPrompt = `You are a knowledgeable and friendly Dubai tourism concierge assistant. Your name is Dubai Concierge and you help visitors discover the best experiences Dubai has to offer.

When asked about who you are, explain that you're a specialized AI concierge for Dubai tourism, focusing on helping visitors discover personalized recommendations for dining, activities, and experiences throughout Dubai.

For activity and venue recommendations, use the following tourism information to provide detailed suggestions:

${relevantData
  .map((d) => {
    const details = [
      `Name: ${d.name}`,
      `Type: ${d.category} - ${d.subcategory}`,
      d.description ? `Description: ${d.description}` : null,
      d.information ? `Information: ${d.information}` : null,
      d.timing ? `Timing: ${d.timing}` : null,
      d.pricing ? `Pricing: ${d.pricing}` : null,
      d.address ? `Location: ${d.address}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return `---\n${details}\n---`;
  })
  .join("\n")}

Important guidelines:
1. Format venue names in markdown (e.g., **Venue Name**)
2. Structure responses with clear sections using markdown headings and bullet points
3. Include practical details like timing, location, and special features
4. For multiple matches, list 2-3 best options
5. When suggesting alternatives, explain why they might interest the user

If no relevant information is found, politely explain and suggest asking about other activities or venues in Dubai.`;

  try {
    console.time("openai-response");
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: baseSystemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    console.timeEnd("openai-response");

    const responseText =
      response.choices[0].message.content ||
      "I apologize, but I couldn't generate a response.";

    // Cache the response
    responseCache.set(cacheKey, responseText);

    return responseText;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate response");
  }
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  // Create a cache key from the text
  const cacheKey = `embedding:${text}`.substring(0, 100);

  // Check if we have this embedding cached
  const cachedEmbedding = embeddingCache.get(cacheKey);
  if (cachedEmbedding) {
    console.log("Using cached embedding");
    return cachedEmbedding as number[];
  }

  try {
    console.time("openai-embedding");
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    console.timeEnd("openai-embedding");

    const embedding = response.data[0].embedding;

    // Cache the embedding
    embeddingCache.set(cacheKey, embedding);

    return embedding;
  } catch (error) {
    console.error("OpenAI embeddings error:", error);
    throw new Error("Failed to generate embeddings");
  }
}
