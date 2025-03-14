import { NextRequest } from "next/server";
import { insertMessageSchema } from "@/shared/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { messages } from "@/shared/schema";
import { storage } from "@/lib/storage";
import { vectorStore } from "@/lib/vectorStore";
import { generateResponse, generateEmbeddings } from "@/lib/openai";
import { z } from "zod";
import { findCategoryMatch } from "@/lib/categoryMapping";

// Add this to the top of your routes
export const runtime = "edge";

// GET /api/messages - Get messages by user ID
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.user_id, userId))
      .orderBy(messages.timestamp);

    return Response.json(result);
  } catch (error) {
    console.error("Database error:", error);
    return Response.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message and get AI response
export async function POST(req: NextRequest) {
  console.time("total-request");
  try {
    const body = await req.json();
    const { content, user_id } = body || {};

    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    // Time the different stages
    console.time("validate-message");
    // Validate the message structure
    let userMessage;
    try {
      userMessage = insertMessageSchema.parse({
        content,
        role: "user",
        user_id,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Response.json(
          { error: "Invalid message format", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }
    console.timeEnd("validate-message");

    // Store user message
    console.time("store-user-message");
    await storage.createMessage(userMessage);
    console.timeEnd("store-user-message");

    // Initialize vector store if needed
    if (!vectorStore.isInitialized()) {
      console.time("vector-store-init");
      await vectorStore.initialize();
      console.timeEnd("vector-store-init");
    }

    // Process in parallel - both embedding generation and message history
    console.time("parallel-processing");
    const [queryEmbeddings, messageHistory] = await Promise.all([
      generateEmbeddings(userMessage.content),
      storage.getMessages(user_id),
    ]);
    console.timeEnd("parallel-processing");

    // Use the existing category mapping function
    const { category, subcategory } = findCategoryMatch(content);
    console.log(`Category detection result: ${category}/${subcategory}`);

    // Find similar activities using the vectorStore's built-in category filtering
    const relevantData = await vectorStore.findSimilar(
      queryEmbeddings,
      category ? 25 : 5, // Increase limit when category is detected
      category,
      subcategory
    );

    // Generate the response
    const response = await generateResponse(
      messageHistory.map((m) => ({ role: m.role, content: m.content })),
      relevantData
    );

    // Store AI response
    await storage.createMessage({
      content: response,
      role: "assistant",
      user_id,
    });

    console.timeEnd("total-request");
    return Response.json({ response });
  } catch (error) {
    console.error("Request error:", error);
    return Response.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// DELETE /api/messages - Delete all messages for a user
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    await db.delete(messages).where(eq(messages.user_id, userId));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    return Response.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
