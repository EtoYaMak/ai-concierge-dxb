'use client'
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";

// Define the type for streaming response chunks
interface StreamChunk {
    id: string;
    type: "sentence" | "partial" | "complete";
    content: string;
    timestamp: number;
    isFinal: boolean;
    metadata?: {
        isListItem?: boolean;
        index?: number;
        totalItems?: number;
        error?: boolean;
    };
}

interface RealTimeVoiceAssistantProps {
    onStateChange?: (state: 'idle' | 'listening' | 'speaking') => void;
    userId?: string; // Add userId prop for message API
}

// Define the handle type that we'll expose to parent components
export interface VoiceAssistantHandle {
    toggleListening: () => void;
    cleanup: () => void;
}

const RealTimeVoiceAssistant = forwardRef<VoiceAssistantHandle, RealTimeVoiceAssistantProps>(
    ({ onStateChange, userId = "default-user" }, ref) => {
        const [isListening, setIsListening] = useState(false);
        const [isSpeaking, setIsSpeaking] = useState(false);
        const [isInitialized, setIsInitialized] = useState(false);

        // Add state for tracking streamed response chunks
        const [currentResponseChunks, setCurrentResponseChunks] = useState<StreamChunk[]>([]);
        const [isReceivingResponse, setIsReceivingResponse] = useState(false);
        const [isWaitingForApiResponse, setIsWaitingForApiResponse] = useState(false);

        const audioRef = useRef<HTMLAudioElement | null>(null);
        const pcRef = useRef<RTCPeerConnection | null>(null);
        const streamRef = useRef<MediaStream | null>(null);
        const dcRef = useRef<RTCDataChannel | null>(null);
        const errorRef = useRef<Error | null>(null);

        // Add a ref to store the latest transcription
        const latestTranscriptionRef = useRef<{ itemId: string, transcript: string } | null>(null);

        // Update parent component when state changes
        useEffect(() => {
            let currentState: 'idle' | 'listening' | 'speaking' = 'idle';

            if (isListening) {
                currentState = 'listening';
            } else if (isSpeaking) {
                currentState = 'speaking';
            }

            onStateChange?.(currentState);
        }, [isListening, isSpeaking, onStateChange]);

        // Function to handle function calls from the model
        const handleFunctionCall = async (functionName: string, callId: string, arguments_: string) => {
            console.log(`Function call received: ${functionName}, callId: ${callId}, arguments:`, arguments_);

            if (functionName === "get_current_time") {
                // Get the current time in a user-friendly format
                const now = new Date();
                const timeString = now.toLocaleTimeString();
                const dateString = now.toLocaleDateString();

                // Send the function call response back to the model
                if (dcRef.current && dcRef.current.readyState === "open") {
                    const functionResponse = {
                        event_id: `event_${Date.now()}`,
                        type: "conversation.item.create",
                        item: {
                            type: "function_call_output",
                            call_id: callId,
                            output: JSON.stringify({
                                time: timeString,
                                date: dateString,
                                timestamp: now.getTime()
                            })
                        }
                    };

                    dcRef.current.send(JSON.stringify(functionResponse));

                    // Create a response to follow the function output
                    setTimeout(() => {
                        if (dcRef.current && dcRef.current.readyState === "open") {
                            console.log("Triggering assistant response generation with explicit modalities");
                            const responseCreateEvent = {
                                event_id: `event_${Date.now()}`,
                                type: "response.create",
                                response: {
                                    modalities: ["text", "audio"],  // Explicitly request audio
                                    conversation: "auto"            // Use the default conversation
                                }
                            };
                            dcRef.current.send(JSON.stringify(responseCreateEvent));
                        }
                    }, 100);
                }
            }
            else if (functionName === "send_transcription") {
                try {
                    // Get the latest transcription from our ref, or fall back to arguments
                    let transcription = "";

                    if (latestTranscriptionRef.current && latestTranscriptionRef.current.transcript) {
                        transcription = latestTranscriptionRef.current.transcript;
                        console.log(`Using stored transcription: "${transcription}"`);
                    } else {
                        // Try to parse arguments as fallback
                        try {
                            const args = arguments_ ? JSON.parse(arguments_) : {};
                            transcription = args.transcription || "No transcription available";
                        } catch (e) {
                            console.error("Error parsing arguments:", e);
                            transcription = "Failed to parse transcription";
                        }
                    }

                    // Use provided userId or default
                    const effectiveUserId = userId || "voice-user";

                    console.log(`Processing transcription: "${transcription}" for user ${effectiveUserId}`);

                    // Clear previous response chunks
                    setCurrentResponseChunks([]);
                    setIsReceivingResponse(true);
                    setIsWaitingForApiResponse(true);

                    // Send the transcription to the voice API endpoint instead of messages/stream
                    const response = await fetch("/api/voice", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            content: transcription,
                            user_id: effectiveUserId
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`API response error: ${response.status}`);
                    }

                    // Read the streaming response
                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error("Failed to get response reader");
                    }

                    let fullResult = "";
                    let partialResponse = "";
                    const streamedChunks: StreamChunk[] = [];

                    // Track if we have a response started event
                    let hasStartedResponse = false;

                    // Process the stream of JSON chunks
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Convert the chunk to text
                        const textChunk = new TextDecoder().decode(value);

                        // Split by newlines to handle multiple JSON objects
                        const jsonLines = textChunk.trim().split('\n');

                        for (const line of jsonLines) {
                            if (!line.trim()) continue;

                            try {
                                const chunkData = JSON.parse(line) as StreamChunk;
                                console.log("Received chunk:", chunkData.type, chunkData.content.substring(0, 50) + '...');

                                // First chunk received, no longer waiting for initial API response
                                if (isWaitingForApiResponse) {
                                    setIsWaitingForApiResponse(false);
                                }

                                // Store the chunk for later processing
                                streamedChunks.push(chunkData);

                                // Add to our state for UI display
                                setCurrentResponseChunks(prev => [...prev, chunkData]);

                                // Add to our full result for sending back to the model later
                                if (chunkData.type === "sentence" || chunkData.type === "complete") {
                                    partialResponse += chunkData.content + " ";
                                }

                                // If this is the first chunk received, send a started event
                                if (!hasStartedResponse && dcRef.current && dcRef.current.readyState === "open") {
                                    hasStartedResponse = true;

                                    // Send a notification that we're starting to get chunks
                                    const startEvent = {
                                        event_id: `event_${Date.now()}`,
                                        type: "conversation.item.create",
                                        item: {
                                            type: "message",
                                            role: "assistant",
                                            content: [
                                                {
                                                    type: "text",
                                                    text: "Processing your request..."
                                                }
                                            ]
                                        }
                                    };
                                    dcRef.current.send(JSON.stringify(startEvent));
                                }

                                // When we get a complete chunk, we have the full response
                                if (chunkData.type === "complete") {
                                    fullResult = chunkData.content;
                                    setIsReceivingResponse(false);
                                }
                            } catch (e) {
                                console.error("Error parsing JSON chunk:", e, "Raw chunk:", line);
                            }
                        }
                    }

                    console.log(`Received ${streamedChunks.length} chunks, final response length: ${fullResult.length} chars`);

                    // Send the function call response back to the model with the complete result
                    if (dcRef.current && dcRef.current.readyState === "open") {
                        const functionResponse = {
                            event_id: `event_${Date.now()}`,
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output: JSON.stringify({
                                    result: fullResult,
                                    success: true,
                                    chunked: true,
                                    chunk_count: streamedChunks.length
                                })
                            }
                        };

                        dcRef.current.send(JSON.stringify(functionResponse));

                        // Create a response to follow the function output
                        setTimeout(() => {
                            if (dcRef.current && dcRef.current.readyState === "open") {
                                console.log("Triggering assistant response generation with explicit modalities");
                                const responseCreateEvent = {
                                    event_id: `event_${Date.now()}`,
                                    type: "response.create",
                                    response: {
                                        modalities: ["text", "audio"],  // Explicitly request audio
                                        conversation: "auto"            // Use the default conversation
                                    }
                                };
                                dcRef.current.send(JSON.stringify(responseCreateEvent));
                            }
                        }, 100);
                    }
                } catch (error: unknown) {
                    console.error("Error processing transcription:", error);
                    setIsReceivingResponse(false);
                    setIsWaitingForApiResponse(false);

                    // Send error response back to the model
                    if (dcRef.current && dcRef.current.readyState === "open") {
                        const functionResponse = {
                            event_id: `event_${Date.now()}`,
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output: JSON.stringify({
                                    error: `Failed to process transcription: ${error instanceof Error ? error.message : 'Unknown error'}`,
                                    success: false
                                })
                            }
                        };

                        dcRef.current.send(JSON.stringify(functionResponse));

                        // Create a response even after error
                        setTimeout(() => {
                            if (dcRef.current && dcRef.current.readyState === "open") {
                                const responseCreateEvent = {
                                    event_id: `event_${Date.now()}`,
                                    type: "response.create"
                                };
                                dcRef.current.send(JSON.stringify(responseCreateEvent));
                            }
                        }, 100);
                    }
                }
            }
        };

        // Cleanup function to safely release resources
        const cleanup = () => {
            // Stop all tracks in the media stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            // Close the peer connection
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }

            // Remove the audio element from DOM
            if (audioRef.current && audioRef.current.parentNode) {
                audioRef.current.srcObject = null;
                audioRef.current.parentNode.removeChild(audioRef.current);
                audioRef.current = null;
            }

            // Reset state
            setIsListening(false);
            setIsSpeaking(false);
            setIsInitialized(false);
            setIsReceivingResponse(false);
            setIsWaitingForApiResponse(false);

            // Clear any previous transcriptions and responses when stopping
            latestTranscriptionRef.current = null;
            setCurrentResponseChunks([]);

            onStateChange?.('idle');
        };

        // Expose methods to parent component using useImperativeHandle
        useImperativeHandle(ref, () => ({
            toggleListening: () => {
                if (!isInitialized) {
                    initialize();
                } else {
                    cleanup();
                }
            },
            cleanup
        }));

        // Cleanup on component unmount
        useEffect(() => {
            return () => {
                cleanup();
            };
        }, []);

        // Initialize the voice assistant
        const initialize = async () => {
            if (isInitialized) {
                return;
            }

            try {
                // Clear any previous data
                latestTranscriptionRef.current = null;
                setCurrentResponseChunks([]);

                setIsInitialized(true);

                // Get an ephemeral key from your server
                const tokenResponse = await fetch("/api/session");
                const data = await tokenResponse.json();
                const EPHEMERAL_KEY = data.client_secret.value;

                // Create a peer connection
                const pc = new RTCPeerConnection();
                pcRef.current = pc;

                // Set up to play remote audio from the model - use a ref to avoid duplicates
                if (!audioRef.current) {
                    audioRef.current = document.createElement("audio");
                    audioRef.current.autoplay = true;
                    document.body.appendChild(audioRef.current);
                }

                // Detect when audio is playing
                audioRef.current.onplaying = () => {
                    setIsSpeaking(true);
                };

                audioRef.current.onpause = () => {
                    setIsSpeaking(false);
                };

                audioRef.current.onended = () => {
                    setIsSpeaking(false);
                };

                pc.ontrack = e => {
                    if (audioRef.current) {
                        audioRef.current.srcObject = e.streams[0];
                    }
                };

                // Add local audio track for microphone input in the browser
                const ms = await navigator.mediaDevices.getUserMedia({
                    audio: true
                });
                streamRef.current = ms;
                pc.addTrack(ms.getTracks()[0]);

                // Set up data channel for sending and receiving events
                const dc = pc.createDataChannel("oai-events");
                dcRef.current = dc;

                dc.addEventListener("message", (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        console.log("Received event:", data.type);

                        // Handle input/output audio stream events
                        if (data.type === "input_audio_stream_started") {
                            setIsListening(true);
                        } else if (data.type === "input_audio_stream_ended") {
                            setIsListening(false);
                        } else if (data.type === "output_audio_stream_started") {
                            setIsSpeaking(true);
                        } else if (data.type === "output_audio_stream_ended") {
                            setIsSpeaking(false);
                        }
                        // Handle error events with detailed logging
                        else if (data.type === "error") {
                            console.error("Received error event from server:", data.error);
                            // Log full error details
                            if (data.error) {
                                console.error("Error type:", data.error.type);
                                console.error("Error message:", data.error.message);
                                console.error("Error code:", data.error.code);
                            }
                        }
                        // Handle response events for debugging
                        else if (data.type === "response.created" || data.type === "response.done") {
                            console.log("Response event details:", data);
                        }
                        // Handle transcription completed events
                        else if (data.type === "conversation.item.input_audio_transcription.completed") {
                            console.log("Transcription completed:", data.transcript);
                            // Store the transcription for later use
                            latestTranscriptionRef.current = {
                                itemId: data.item_id,
                                transcript: data.transcript
                            };
                        }
                        // Handle function calls from the model
                        else if (data.type === "conversation.item.created" &&
                            data.item &&
                            data.item.type === "function_call") {
                            // Extract function call details
                            const functionName = data.item.name;
                            const callId = data.item.call_id;
                            const args = data.item.arguments;

                            // Handle the function call
                            handleFunctionCall(functionName, callId, args);
                        }
                    } catch (err) {
                        console.error("Error parsing data channel message:", err);
                    }
                });

                // Start the session using the Session Description Protocol (SDP)
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                const baseUrl = "https://api.openai.com/v1/realtime";
                const model = "gpt-4o-mini-realtime-preview-2024-12-17";
                const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                    method: "POST",
                    body: offer.sdp,
                    headers: {
                        Authorization: `Bearer ${EPHEMERAL_KEY}`,
                        "Content-Type": "application/sdp"
                    },
                });

                const answer: RTCSessionDescriptionInit = {
                    type: "answer",
                    sdp: await sdpResponse.text(),
                };
                await pc.setRemoteDescription(answer);

                // Now we're connected and ready to listen
                setIsListening(true);

            } catch (error) {
                console.error("Error initializing voice assistant:", error);
                cleanup();
            }
        };

        // Local toggle function for the UI button
        const toggleListening = () => {
            if (!isInitialized) {
                // Initialize if not already done
                initialize();
            } else {
                // Clean up and close the connection
                cleanup();
            }
        };

        // Helper function to render a response chunk with appropriate styling
        const renderResponseChunk = (chunk: StreamChunk) => {
            const isListItem = chunk.metadata?.isListItem;
            const listItemIndex = chunk.metadata?.index;
            const content = chunk.content;

            // Check if the content starts with a number followed by a period or dot
            const startsWithNumber = /^\d+[\.\):]/.test(content);
            const isNumberedListItem = isListItem || startsWithNumber;

            // Clean up the content if it's a numbered list item
            let displayContent = content;
            if (startsWithNumber) {
                // Keep the number but enhance the formatting
                const numberMatch = content.match(/^(\d+)[\.\):](.*)$/);
                if (numberMatch && numberMatch.length >= 3) {
                    const [_, number, text] = numberMatch;
                    displayContent = text.trim();
                    return (
                        <div
                            key={chunk.id}
                            className="mb-2 p-2 ml-2 flex"
                        >
                            <span className="font-bold mr-2 min-w-6 text-right">{number}.</span>
                            <span>{displayContent}</span>
                        </div>
                    );
                }
            }

            // For items with bold/emphasized content like "**Beach Name**"
            const boldPattern = /\*\*(.*?)\*\*/;
            if (boldPattern.test(displayContent)) {
                displayContent = displayContent.replace(boldPattern, (match, p1) => {
                    return `<strong>${p1}</strong>`;
                });

                return (
                    <div
                        key={chunk.id}
                        className={`mb-2 p-2 rounded ${isNumberedListItem ? 'ml-4' : ''}`}
                        dangerouslySetInnerHTML={{ __html: displayContent }}
                    />
                );
            }

            return (
                <div
                    key={chunk.id}
                    className={`mb-2 p-2 rounded ${isNumberedListItem ? 'ml-4' : ''}`}
                >
                    {isListItem && !startsWithNumber && <span className="font-bold mr-2">•</span>}
                    {displayContent}
                </div>
            );
        };

        return (
            <div className="w-full max-w-md mx-auto p-4 border rounded-lg shadow-sm">
                <h1 className="text-2xl font-bold mb-4">Real Time Voice Assistant</h1>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        <p className="text-sm text-muted-foreground">
                            {isSpeaking ? "AI is speaking" : isListening ? "Listening to you" : "Waiting"}
                        </p>
                    </div>

                    <Button
                        onClick={toggleListening}
                        className={`${isInitialized ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                    >
                        {isInitialized ? "Stop Assistant" : "Start Assistant"}
                    </Button>

                    {/* Display transcription if available */}
                    {latestTranscriptionRef.current && latestTranscriptionRef.current.transcript && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-500">You said:</h3>
                            <p className="p-2 bg-gray-50 rounded">{latestTranscriptionRef.current.transcript}</p>
                        </div>
                    )}

                    {/* Show loading spinner when waiting for initial API response */}
                    {isWaitingForApiResponse && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-500">Processing...</h3>
                            <div className="flex justify-center items-center p-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        </div>
                    )}

                    {/* Display response chunks */}
                    {currentResponseChunks.length > 0 && (
                        <div className="mt-4">
                            <h3 className="text-sm font-semibold text-gray-500">Assistant response:</h3>
                            <div className="p-3 bg-gray-50 rounded max-h-60 overflow-y-auto">
                                {currentResponseChunks
                                    .filter(chunk => chunk.type === "sentence" || chunk.type === "complete")
                                    .map(renderResponseChunk)}

                                {isReceivingResponse && !isWaitingForApiResponse && (
                                    <div className="flex items-center mt-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce mr-1"></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce mr-1" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
);

// Display name for debugging
RealTimeVoiceAssistant.displayName = "RealTimeVoiceAssistant";

export default RealTimeVoiceAssistant;