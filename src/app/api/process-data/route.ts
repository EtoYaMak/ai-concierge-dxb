import { NextRequest, NextResponse } from "next/server";
import { processNestedData } from "../lib/processData";

export async function POST(req: NextRequest) {
  try {
    await processNestedData();
    return NextResponse.json({ message: "Data processing completed" });
  } catch (error) {
    console.error("Error processing data:", error);
    return NextResponse.json(
      { error: "Failed to process data" },
      { status: 500 }
    );
  }
}
