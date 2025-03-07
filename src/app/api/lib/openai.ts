import OpenAI from "openai";
import { type Activity } from "@/shared/schema";
import NodeCache from "node-cache";
import {
  type ChatCompletionSystemMessageParam,
  type ChatCompletionUserMessageParam,
} from "openai/resources/chat/completions";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// We can use a faster model but with better prompting for quality output
// You can switch back to gpt-4o if responses are still not high quality enough
const CHAT_MODEL = "gpt-4o";

const embeddingCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 }); // 24 hour cache

export async function generateResponse(
  messages: { role: string; content: string }[],
  relevantData: Activity[],
  streamCallback?: (chunk: string) => void
): Promise<string> {
  try {
    // Format context from relevant activities
    const contextData = relevantData
      .map((item) => {
        return `
Name: ${item.name}
Category: ${item.category}
${item.subcategory ? `Subcategory: ${item.subcategory}` : ""}
${item.description ? `Description: ${item.description}` : ""}
${item.information ? `Details: ${item.information}` : ""}
${item.timing ? `Timing: ${item.timing}` : ""}
${item.pricing ? `Pricing: ${item.pricing}` : ""}
${item.booking_type ? `Booking: ${item.booking_type}` : ""}
${item.address ? `Location: ${item.address}` : ""}
`;
      })
      .join("\n");

    // Prepare system message with context and instructions
    const systemMessage = `
You are a friendly, conversational concierge who speaks naturally like a human, not an AI.

${
  relevantData.length > 0
    ? `I have some information about activities that might interest the user:\n${contextData}\n\n
       Your approach should be:
       1. When the user asks for a specific category (e.g., "Beach Clubs"), LIST ALL venues from that category present in the data I provided. Do not omit any options.
       2. Format category listings as a clean, organized list showing ALL venues with a short description.
       3. Do not selectively choose only some venues - include EVERY venue from the requested category.
       `
    : "Provide a brief, friendly greeting and ask how you can help."
}

IMPORTANT: When listing venues from a category, you MUST include EVERY venue from the provided data. Do not filter or limit the list based on your own judgment.

IMPORTANT GUIDELINES:
- When a user explicitly asks for a category (e.g., "Beach clubs to chill"), list ALL activities options names and a short description from the caterogy.
- If best match is found, LIST ALL options from the category.
- For category-specific searches, format your response as a well-organized list of options with key details
- For general queries, keep responses brief and conversational
- Strictly adhere to category hierarchies - don't recommend restaurants when users ask for beach clubs
- Use a warm, friendly tone with occasional emojis
- Ask questions to understand preferences better if the query is general

Always format responses using markdown, with clear organization for lists of venues.
`;
    //  4. Mention only 1-2 options initially with minimal details
    //// If streaming is requested, use streaming approach
    if (streamCallback) {
      const stream = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content: systemMessage,
          } as ChatCompletionSystemMessageParam,
          ...messages.map((msg) => {
            if (msg.role === "user") {
              return {
                role: "user",
                content: msg.content,
              } as ChatCompletionUserMessageParam;
            } else if (msg.role === "assistant") {
              return { role: "assistant", content: msg.content } as const;
            } else if (msg.role === "system") {
              return {
                role: "system",
                content: msg.content,
              } as ChatCompletionSystemMessageParam;
            }
            // Fall back to user if unknown role
            return {
              role: "user",
              content: msg.content,
            } as ChatCompletionUserMessageParam;
          }),
        ],
        stream: true,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          streamCallback(content);
        }
      }

      return fullResponse;
    } else {
      // Original non-streaming approach
      const response = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content: systemMessage,
          } as ChatCompletionSystemMessageParam,
          ...messages.map((msg) => {
            if (msg.role === "user") {
              return {
                role: "user",
                content: msg.content,
              } as ChatCompletionUserMessageParam;
            } else if (msg.role === "assistant") {
              return { role: "assistant", content: msg.content } as const;
            } else if (msg.role === "system") {
              return {
                role: "system",
                content: msg.content,
              } as ChatCompletionSystemMessageParam;
            }
            // Fall back to user if unknown role
            return {
              role: "user",
              content: msg.content,
            } as ChatCompletionUserMessageParam;
          }),
        ],
      });

      return (
        response.choices[0].message.content ||
        "I'm not sure how to respond to that."
      );
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    return "Sorry, I'm having trouble generating a response right now.";
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
