import { NextRequest, NextResponse } from "next/server";
import { insertMessageSchema } from "@/shared/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { messages } from "@/shared/schema";
import { storage } from "../storage";
import { vectorStore } from "../lib/vectorStore";
import { generateResponse, generateEmbeddings } from "../lib/openai";
import { z } from "zod";

// GET /api/messages - Get messages by user ID
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Force a direct query to bypass any potential issues in the storage layer
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.user_id, userId))
      .orderBy(messages.timestamp);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message and get AI response
export async function POST(req: NextRequest) {
  try {
    console.log("API request received:", {
      headers: Object.fromEntries(req.headers.entries()),
      url: req.url,
      method: req.method,
    });

    // Changed to handle the request body more safely for Vercel environment
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing JSON body:", error);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    console.log("Request body:", body);

    const { content, user_id } = body || {};

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Validate the message structure
    const userMessage = insertMessageSchema.parse({
      content,
      role: "user",
      user_id,
    });

    // Store user message
    const savedUserMessage = await storage.createMessage(userMessage);

    // Generate embeddings for the query
    const queryEmbeddings = await generateEmbeddings(userMessage.content);

    // Find relevant tourist data
    const relevantData = await vectorStore.findSimilar(queryEmbeddings);

    // Get chat history
    const messageHistory = await storage.getMessages(user_id);

    // Generate AI response
    const aiResponse = await generateResponse(
      messageHistory.map((m) => ({ role: m.role, content: m.content })),
      relevantData
    );

    // Store AI response
    const savedAiMessage = await storage.createMessage({
      content: aiResponse,
      role: "assistant",
      user_id,
    });

    return NextResponse.json({
      userMessage: savedUserMessage,
      aiMessage: savedAiMessage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid message format", details: error.errors },
        { status: 400 }
      );
    } else {
      console.error("Error processing message:", error);
      return NextResponse.json(
        { error: "Failed to process message" },
        { status: 500 }
      );
    }
  }
}

// DELETE /api/messages - Delete all messages for a user
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    // Delete all messages for the user
    await db.delete(messages).where(eq(messages.user_id, userId)).execute();

    return NextResponse.json({ message: "Messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
