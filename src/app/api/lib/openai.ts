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
const CHAT_MODEL = "gpt-4o-mini";

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
${item.information ? `Information: ${item.information}` : ""}
${item.timing ? `Timing: ${item.timing}` : ""}
${item.address ? `Address: ${item.address}` : ""}
`;
      })
      .join("\n");

    // Prepare system message with context and instructions
    const systemMessage = `
You are a helpful AI concierge for tourists in Dubai. Use the following relevant information to answer the user's query:

${contextData}

Always be polite and helpful. If you don't know something, acknowledge it and suggest alternatives.

Format your responses using markdown for better readability:
- Use ## for section headers
- Use **bold** for emphasis and key points
- Use bullet points and numbered lists where appropriate
- Use > for important notes or quotes
`;

    // If streaming is requested, use streaming approach
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
