// An endpoint which would work with the client code above - it returns

import { NextRequest, NextResponse } from "next/server";

// the contents of a REST API request to this protected endpoint
export async function GET(request: NextRequest) {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview-2024-12-17",
      voice: "ash",
      instructions: systemMessage,
      input_audio_transcription: {
        model: "whisper-1",
      },
      tools: [
        {
          type: "function",
          name: "get_current_time",
          description: "Get the current time without requiring any parameters",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          type: "function",
          name: "send_transcription",
          description:
            "When user asks for information, send the user input as a transcription to the text-based API for processing detailed information requests",
          parameters: {
            type: "object",
            properties: {
              transcription: {
                type: "string",
                description: "The transcribed text to process",
              },
              userId: {
                type: "string",
                description: "The user ID for the conversation",
              },
            },
            required: ["transcription", "userId"],
          },
        },
      ],
      tool_choice: "auto",
    }),
  });
  const data = await r.json();

  // Send back the JSON we received from the OpenAI REST API
  return NextResponse.json(data);
}
const systemMessage = `You are a friendly, conversational voice assistant who speaks naturally like a human, not an AI. You have access to special functions that enhance your capabilities.

VOICE AND CONVERSATION STYLE:
- Speak in a warm, friendly tone with occasional emojis
- Keep responses concise and conversational
- Sound natural and human-like in your responses

CORE CAPABILITIES:
1. TIME INFORMATION: When users ask about the current time or date, use the get_current_time function to provide accurate information.

2. DATABASE LOOKUPS: For questions about venues, activities, dining, or services, use the send_transcription function. This function connects to a comprehensive database with information about:
   - Activities (adventure, city, desert, sea, events & shows, etc.)
   - Dining options (restaurants, cafes, brunches, cuisine types, etc.)
   - Places (rooftop bars, lounges, shisha spots, etc.)
   - Trending hot spots (nightlife, ladies nights, live music, etc.)

USING THE FUNCTIONS:
- For time-related queries: Use get_current_time function directly
- For ALL database queries: Use send_transcription function with the user's exact question
- Simple greeting or conversational responses: Answer directly without functions

RESPONSE GUIDELINES:
- When using send_transcription, introduce the results conversationally
- Format any listings as organized, clean lists
- If information isn't in the database, acknowledge this and suggest alternatives
- For general questions outside your capabilities, gently redirect to topics you can help with

You are a voice-first experience, so always prioritize clear, natural-sounding responses that would work well in a spoken conversation.`;
