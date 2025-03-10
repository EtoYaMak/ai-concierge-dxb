import { NextResponse } from "next/server";
import { findCategoryMatch } from "../../lib/categoryMapping";
import { generateEmbeddings } from "../../lib/openai";
import { vectorStore } from "../../lib/vectorStore";
import { storage } from "../../storage";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { transcript, userId } = await req.json();

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Store user message
    if (userId) {
      await storage.createMessage({
        content: transcript,
        role: "user",
        user_id: userId,
      });
    }

    // Make sure vector store is initialized
    if (!vectorStore.isInitialized()) {
      await vectorStore.initialize();
    }

    // Use keyword matching to find relevant category/subcategory
    const categoryMatch = findCategoryMatch(transcript);

    // Get embeddings for vector search
    const embeddings = await generateEmbeddings(transcript);

    // Search for relevant activities in the database
    const relevantResults = await vectorStore.findSimilar(
      embeddings,
      10,
      categoryMatch.category,
      categoryMatch.subcategory
    );

    // Format results for response
    let responseText = "";

    if (relevantResults && relevantResults.length > 0) {
      // Create a concise response based on the results
      const topResult = relevantResults[0];

      responseText = `I found ${relevantResults.length} options for you. `;

      if (topResult.name) {
        responseText += `The top suggestion is ${topResult.name}. `;

        if (topResult.description) {
          responseText += `${topResult.description} `;
        }

        if (topResult.pricing) {
          responseText += `Pricing: ${topResult.pricing} `;
        }

        if (relevantResults.length > 1) {
          responseText += `Other options include ${relevantResults
            .slice(1, 3)
            .map((r) => r.name)
            .join(", ")}.`;
        }
      }
    } else {
      responseText =
        "I'm sorry, I couldn't find any specific information about that in my database. Could you try asking in a different way or about something else?";
    }

    // Store assistant's response
    if (userId) {
      await storage.createMessage({
        content: responseText,
        role: "assistant",
        user_id: userId,
      });
    }

    return NextResponse.json({ responseText });
  } catch (error) {
    console.error("Error processing voice transcript:", error);
    return NextResponse.json(
      { error: "Failed to process voice transcript" },
      { status: 500 }
    );
  }
}
