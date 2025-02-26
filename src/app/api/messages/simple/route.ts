// Create a new simplified endpoint
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Just echo back what was sent for testing
    return new Response(
      JSON.stringify({
        received: body,
        success: true,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
