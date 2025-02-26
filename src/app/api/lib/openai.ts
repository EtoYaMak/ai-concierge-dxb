import OpenAI from "openai";
import { type Activity } from "@/shared/schema";
import NodeCache from "node-cache";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// We can use a faster model but with better prompting for quality output
// You can switch back to gpt-4o if responses are still not high quality enough
const CHAT_MODEL = "gpt-3.5-turbo";

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

  // Restore the premium styling but keep it efficient
  const baseSystemPrompt = `You are a premium Dubai concierge assistant, providing sophisticated, well-formatted responses about Dubai's luxury experiences and attractions.

Use this relevant information about Dubai attractions:
${relevantData
  .map((d) => {
    return `- **${d.name}** (${d.category}/${d.subcategory}): ${
      d.description?.substring(0, 200) || ""
    }
    ${d.timing ? `Hours: ${d.timing}` : ""}
    ${d.pricing ? `Price: ${d.pricing}` : ""}
    ${d.address ? `Location: ${d.address}` : ""}`;
  })
  .join("\n\n")}

Always format your responses in a premium style:
- Use **bold** for venue names and headings
- Structure with markdown headings (## for sections)
- Use bullet points for listing features or options
- Include practical details: timing, location, price ranges
- Be concise but comprehensive and professional
- If suggesting multiple venues, present each with clear separation

Your tone should be professional, knowledgeable and sophisticated - you're a luxury concierge for high-end visitors to Dubai.`;

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
