'use client'
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";

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

                    // NEW: Create a response to follow the function output
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

                    // Send the transcription to your messages API
                    const response = await fetch("/api/messages/stream", {
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

                    let textResult = "";

                    // Process the stream
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        // Convert the chunk to text and append to result
                        const chunk = new TextDecoder().decode(value);
                        textResult += chunk;
                    }

                    // NEW: Add detailed logging to inspect the API response
                    console.log("====== API RESPONSE DATA ======");
                    console.log(textResult);
                    console.log("===============================");

                    // Try to summarize the size and content of the response
                    console.log(`Response size: ${textResult.length} characters`);
                    console.log(`Response preview: ${textResult.substring(0, 200)}...`);

                    // Check if the response contains listings
                    const containsListings = textResult.includes("•") ||
                        textResult.includes("-") ||
                        textResult.includes("1.") ||
                        /\d+\.\s/.test(textResult);
                    console.log(`Response contains listings: ${containsListings}`);

                    // Send the response back to the model
                    if (dcRef.current && dcRef.current.readyState === "open") {
                        const functionResponse = {
                            event_id: `event_${Date.now()}`,
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output: JSON.stringify({
                                    result: textResult,
                                    success: true
                                })
                            }
                        };

                        // NEW: Log what we're sending back to the assistant
                        console.log("Sending function output to assistant:");
                        console.log(JSON.stringify(functionResponse, null, 2));

                        dcRef.current.send(JSON.stringify(functionResponse));

                        // NEW: Create a response to follow the function output
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
                } catch (error) {
                    console.error("Error processing transcription:", error);

                    // Send error response back to the model
                    if (dcRef.current && dcRef.current.readyState === "open") {
                        const functionResponse = {
                            event_id: `event_${Date.now()}`,
                            type: "conversation.item.create",
                            item: {
                                type: "function_call_output",
                                call_id: callId,
                                output: JSON.stringify({
                                    error: `Failed to process transcription: ${errorRef.current?.message}`,
                                    success: false
                                })
                            }
                        };

                        dcRef.current.send(JSON.stringify(functionResponse));

                        // NEW: Create a response even after error
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
                        // NEW: Handle transcription completed events
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

        return (
            <div>
                <h1 className="text-2xl font-bold">Real Time Voice Assistant</h1>
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">
                        {isSpeaking ? "AI is speaking" : isListening ? "Listening to you" : "Waiting"}
                    </p>
                    <Button onClick={toggleListening}>
                        {isInitialized ? "Stop" : "Start"}
                    </Button>
                </div>
            </div>
        );
    }
);

// Display name for debugging
RealTimeVoiceAssistant.displayName = "RealTimeVoiceAssistant";

export default RealTimeVoiceAssistant;