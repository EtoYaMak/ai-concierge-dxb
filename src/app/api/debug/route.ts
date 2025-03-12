import { NextRequest } from "next/server";

// Simple in-memory debug log storage
// In a production app, you'd use a proper logging system
const debugLogs: any[] = [];
const MAX_LOGS = 1000; // Limit the number of logs to prevent memory issues

export async function POST(req: NextRequest) {
  try {
    const logData = await req.json();

    // Add timestamp if not present
    if (!logData.timestamp) {
      logData.timestamp = Date.now();
    }

    // Add to logs
    debugLogs.push(logData);

    // Trim logs if needed
    if (debugLogs.length > MAX_LOGS) {
      debugLogs.shift(); // Remove oldest log
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Debug logging error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to log debug info",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Optional filtering by session ID
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    let filteredLogs = debugLogs;
    if (sessionId) {
      filteredLogs = debugLogs.filter((log) => log.sessionId === sessionId);
    }

    return new Response(JSON.stringify(filteredLogs), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Debug retrieval error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to retrieve debug logs",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Clear logs
export async function DELETE(req: NextRequest) {
  try {
    // Optional filtering by session ID
    const sessionId = req.nextUrl.searchParams.get("sessionId");

    if (sessionId) {
      // Remove logs for specific session
      const initialLength = debugLogs.length;
      for (let i = debugLogs.length - 1; i >= 0; i--) {
        if (debugLogs[i].sessionId === sessionId) {
          debugLogs.splice(i, 1);
        }
      }
      return new Response(
        JSON.stringify({
          success: true,
          removed: initialLength - debugLogs.length,
        })
      );
    } else {
      // Clear all logs
      const count = debugLogs.length;
      debugLogs.length = 0;
      return new Response(
        JSON.stringify({
          success: true,
          removed: count,
        })
      );
    }
  } catch (error) {
    console.error("Debug clear error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to clear debug logs",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
