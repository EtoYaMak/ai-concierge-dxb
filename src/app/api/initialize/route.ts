import { vectorStore } from "@/lib/vectorStore";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    if (!vectorStore.isInitialized()) {
      console.log("Initializing vector store from API route");
      await vectorStore.initialize();
    }

    return NextResponse.json({ success: true, initialized: true });
  } catch (error) {
    console.error("Failed to initialize:", error);
    return NextResponse.json({ success: false, error: "Failed to initialize" });
  }
}
