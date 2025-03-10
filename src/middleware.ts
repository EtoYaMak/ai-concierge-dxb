import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // CRITICAL FIX: Log ALL requests to help debug the interception issue
  console.log(
    `[Middleware] ALL REQUEST: ${request.method} ${
      request.url
    }, Content-Type: ${request.headers.get("content-type")}`
  );

  // Check if this is a realtime API request (more inclusive patterns)
  const isRealtimeRequest =
    request.url.includes("/v1/realtime") ||
    request.url.includes("api.openai.com/realtime") ||
    request.url.includes("openai.com/v1/real") ||
    request.url.includes("/realtime");

  if (isRealtimeRequest) {
    console.log(`[Middleware] DETECTED REALTIME REQUEST: ${request.url}`);
  }

  // CRITICAL: Don't intercept if it's not a JSON request, as WebRTC uses different formats
  if (request.headers.get("content-type")?.includes("application/sdp")) {
    console.log(
      `[Middleware] SDP request detected - passing through without modification`
    );
    return NextResponse.next();
  }

  // Only intercept data channel JSON messages
  if (
    request.headers.get("content-type")?.includes("application/json") &&
    request.method === "POST" &&
    isRealtimeRequest
  ) {
    console.log(
      `[Middleware] Intercepted realtime API request: ${request.url}`
    );

    // Try to read and parse the request body
    try {
      // Clone the request to avoid consuming the body
      const clonedRequest = request.clone();
      let body;
      try {
        body = await clonedRequest.json();
        console.log(
          `[Middleware] Request body type: ${
            body.type || "unknown"
          }, content: ${JSON.stringify(body).substring(0, 100)}...`
        );
      } catch (jsonError) {
        console.log(
          `[Middleware] Could not parse request body as JSON. Content-Type says JSON but might not be. Error: ${jsonError}`
        );
        // Try to read as text to debug
        try {
          const textBody = await request.clone().text();
          console.log(
            `[Middleware] Request body as text (first 100 chars): ${textBody.substring(
              0,
              100
            )}...`
          );
        } catch (textError) {
          console.log(
            `[Middleware] Could not read request body as text either: ${textError}`
          );
        }
        // Continue as if we couldn't parse, don't throw
        body = {};
      }

      // Check if this is a user message with a context URL
      if (body.type === "user_message" && body.context_url) {
        const contextUrl = body.context_url;
        console.log(
          `[Middleware] Detected user_message with context_url: ${contextUrl}`
        );

        // Log the original message for debugging
        const originalText = body.text;
        console.log(
          `[Middleware] Original message: "${originalText?.substring(0, 100)}${
            originalText?.length > 100 ? "..." : ""
          }"`
        );

        // Fetch the database context from our internal API
        console.log(`[Middleware] Fetching context from: ${contextUrl}`);
        const fetchStartTime = performance.now();
        const contextResponse = await fetch(new URL(contextUrl, request.url));
        const fetchDuration = performance.now() - fetchStartTime;
        console.log(
          `[Middleware] Context fetch completed in ${fetchDuration.toFixed(
            2
          )}ms with status: ${contextResponse.status}`
        );

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();

          if (contextData.success && contextData.prompt) {
            console.log(`[Middleware] Successfully retrieved context`);
            console.log(
              `[Middleware] Context prompt size: ${
                contextData.promptSize || contextData.prompt.length
              } characters`
            );
            console.log(
              `[Middleware] Context preview: "${contextData.prompt.substring(
                0,
                200
              )}..."`
            );
            console.log(
              `[Middleware] Original query: "${
                contextData.originalQuery || "unknown"
              }"`
            );

            // Replace the user's message with our context-augmented prompt
            const newBody = {
              ...body,
              text: contextData.prompt, // Use our augmented prompt instead
              context_url: undefined, // Remove the context_url to avoid infinite loops
            };

            console.log(
              `[Middleware] Created new request body with augmented prompt`
            );
            console.log(
              `[Middleware] New body size: ${
                JSON.stringify(newBody).length
              } characters`
            );

            // Create a new request with the modified body
            const newRequest = new NextRequest(request.url, {
              method: request.method,
              headers: request.headers,
              body: JSON.stringify(newBody),
            });

            console.log(
              `[Middleware] ✅ CONTEXT SUCCESSFULLY INJECTED FOR QUERY: "${contextData.originalQuery}"`
            );
            return NextResponse.next({
              request: newRequest,
            });
          } else {
            console.log(
              `[Middleware] Context fetch succeeded but data format was invalid`
            );
            console.log(
              `[Middleware] Context data: ${JSON.stringify(
                contextData
              ).substring(0, 200)}...`
            );
          }
        } else {
          console.log(
            `[Middleware] Failed to fetch context: ${contextResponse.status} ${contextResponse.statusText}`
          );
          try {
            const errorText = await contextResponse.text();
            console.log(`[Middleware] Context error response: ${errorText}`);
          } catch (e) {
            console.log(`[Middleware] Could not read context error response`);
          }
        }
      } else if (isRealtimeRequest && body.type === "user_message") {
        console.log(
          `[Middleware] ⚠️ User message without context_url detected. Text: "${
            body.text?.substring(0, 100) || ""
          }"...`
        );

        // Check if this is already a context message (it will be much longer than a typical user message)
        const isLikelyContextMessage = body.text && body.text.length > 500;
        if (isLikelyContextMessage) {
          console.log(
            `[Middleware] This appears to be a context message already (length: ${body.text.length}) - passing through`
          );
          return NextResponse.next();
        }

        // Try to process this query directly
        try {
          console.log(
            `[Middleware] Emergency query processing for: "${body.text}"`
          );
          const emergencyResponse = await fetch("/api/process-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: body.text }),
          });

          if (emergencyResponse.ok) {
            const emergencyData = await emergencyResponse.json();

            if (emergencyData.success && emergencyData.streamEndpoint) {
              console.log(
                `[Middleware] Got emergency context from: ${emergencyData.streamEndpoint}`
              );

              // Fetch the actual context
              const emergencyContextResponse = await fetch(
                emergencyData.streamEndpoint
              );
              if (emergencyContextResponse.ok) {
                const emergencyContextData =
                  await emergencyContextResponse.json();

                if (
                  emergencyContextData.success &&
                  emergencyContextData.prompt
                ) {
                  console.log(
                    `[Middleware] ✅ EMERGENCY CONTEXT RETRIEVED, injecting into request`
                  );

                  // Create modified request with the emergency context
                  const emergencyNewBody = {
                    ...body,
                    text: emergencyContextData.prompt,
                  };

                  const emergencyNewRequest = new NextRequest(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: JSON.stringify(emergencyNewBody),
                  });

                  console.log(
                    `[Middleware] ✅ EMERGENCY CONTEXT SUCCESSFULLY INJECTED`
                  );
                  return NextResponse.next({
                    request: emergencyNewRequest,
                  });
                }
              }
            }
          }

          console.log(
            `[Middleware] Emergency interception failed, continuing with original request`
          );
        } catch (emergencyError) {
          console.error(
            `[Middleware] Error during emergency interception:`,
            emergencyError
          );
        }
      } else {
        console.log(
          `[Middleware] Not a user_message with context_url, passing through unchanged. Type: ${
            body.type || "unknown"
          }`
        );
      }
    } catch (error) {
      console.error(`[Middleware] Error in middleware:`, error);
      // If there's an error, just let the original request through
      console.log(`[Middleware] Passing through original request due to error`);
    }
  } else if (isRealtimeRequest) {
    console.log(
      `[Middleware] Realtime request but not JSON or not POST, type: ${request.headers.get(
        "content-type"
      )}, method: ${request.method}`
    );
  }

  // For all other requests or if there was an error, just continue
  return NextResponse.next();
}

// Only run the middleware on specific paths - much more inclusive now
export const config = {
  matcher: [
    "/api/session/:path*",
    "/api/process-query/:path*",
    "/api/realtime-context/:path*",
    "/(.*)/v1/realtime/:path*",
    "/(.*)/realtime/:path*",
    // Catch ALL paths to and from OpenAI
    "/(.*)/api.openai.com/:path*",
    "/api/openai/:path*",
  ],
};
