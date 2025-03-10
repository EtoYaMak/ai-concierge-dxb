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
    }),
  });
  const data = await r.json();

  // Send back the JSON we received from the OpenAI REST API
  return NextResponse.json(data);
}
