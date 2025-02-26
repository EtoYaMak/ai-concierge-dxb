import { initializeApp } from "../init";

export const runtime = "edge";

export async function GET(_req: Request) {
  try {
    // Check if vector store is initialized
    const isInitialized = await initializeApp();

    return Response.json({
      status: isInitialized ? "success" : "failed",
      message: isInitialized
        ? "App initialized successfully"
        : "Failed to initialize app",
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
