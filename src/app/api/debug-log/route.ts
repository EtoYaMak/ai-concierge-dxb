import { NextRequest, NextResponse } from "next/server";

// In-memory log storage for debugging purposes
// This would need to be replaced with a more robust solution in production
const MAX_LOGS = 1000;
let debugLogs: {
  timestamp: number;
  message: string;
  level: "info" | "warn" | "error";
  source: string;
  data?: any;
}[] = [];

// Override console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Install the console interceptors
function setupConsoleInterceptors() {
  if (typeof window === "undefined") {
    // Only in Node.js environment
    console.log = function (...args: any[]) {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");

      // Extract source if it's in our expected format [Source]
      let source = "unknown";
      const sourceMatch = message.match(/^\[([\w-]+)\]/);
      if (sourceMatch) {
        source = sourceMatch[1];
      }

      // Add to debug logs
      addDebugLog("info", message, source);

      // Call original
      originalConsoleLog.apply(console, args);
    };

    console.warn = function (...args: any[]) {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");

      // Extract source if it's in our expected format [Source]
      let source = "unknown";
      const sourceMatch = message.match(/^\[([\w-]+)\]/);
      if (sourceMatch) {
        source = sourceMatch[1];
      }

      // Add to debug logs
      addDebugLog("warn", message, source);

      // Call original
      originalConsoleWarn.apply(console, args);
    };

    console.error = function (...args: any[]) {
      const message = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg) : String(arg)
        )
        .join(" ");

      // Extract source if it's in our expected format [Source]
      let source = "unknown";
      const sourceMatch = message.match(/^\[([\w-]+)\]/);
      if (sourceMatch) {
        source = sourceMatch[1];
      }

      // Add to debug logs
      addDebugLog("error", message, source);

      // Call original
      originalConsoleError.apply(console, args);
    };
  }
}

// Function to add a log entry
function addDebugLog(
  level: "info" | "warn" | "error",
  message: string,
  source: string,
  data?: any
) {
  debugLogs.push({
    timestamp: Date.now(),
    message,
    level,
    source,
    data,
  });

  // Trim logs if they exceed the maximum
  if (debugLogs.length > MAX_LOGS) {
    debugLogs = debugLogs.slice(-MAX_LOGS);
  }
}

// Setup interceptors when this module is loaded
setupConsoleInterceptors();

// Direct API logging function for components to use
export function logDebug(
  message: string,
  source: string,
  level: "info" | "warn" | "error" = "info",
  data?: any
) {
  addDebugLog(level, message, source, data);
}

// API endpoint to retrieve logs
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const source = searchParams.get("source");
  const level = searchParams.get("level") as "info" | "warn" | "error" | null;
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const since = parseInt(searchParams.get("since") || "0", 10);

  // Filter logs based on query parameters
  let filteredLogs = debugLogs;

  if (source) {
    filteredLogs = filteredLogs.filter((log) => log.source === source);
  }

  if (level) {
    filteredLogs = filteredLogs.filter((log) => log.level === level);
  }

  if (since > 0) {
    filteredLogs = filteredLogs.filter((log) => log.timestamp > since);
  }

  // Sort logs by timestamp (newest first) and limit
  const sortedLogs = filteredLogs
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    totalLogs: debugLogs.length,
    filteredCount: filteredLogs.length,
    returnedCount: sortedLogs.length,
    logs: sortedLogs,
  });
}

// API endpoint to clear logs
export async function DELETE(req: NextRequest) {
  const oldCount = debugLogs.length;
  debugLogs = [];

  return NextResponse.json({
    success: true,
    message: `Cleared ${oldCount} logs`,
  });
}

// API endpoint to add a custom log
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, source, level = "info", data } = body;

    if (!message || !source) {
      return NextResponse.json(
        { error: "Missing required fields: message and source" },
        { status: 400 }
      );
    }

    addDebugLog(level, message, source, data);

    return NextResponse.json({
      success: true,
      message: "Log added successfully",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add log entry" },
      { status: 500 }
    );
  }
}
