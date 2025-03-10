'use client'
import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "../ui/button";

interface RealTimeVoiceAssistantProps {
    onStateChange?: (state: 'idle' | 'listening' | 'speaking') => void;
}

// Define the handle type that we'll expose to parent components
export interface VoiceAssistantHandle {
    toggleListening: () => void;
    cleanup: () => void;
}

const RealTimeVoiceAssistant = forwardRef<VoiceAssistantHandle, RealTimeVoiceAssistantProps>(
    ({ onStateChange }, ref) => {
        const [isListening, setIsListening] = useState(false);
        const [isSpeaking, setIsSpeaking] = useState(false);
        const [isInitialized, setIsInitialized] = useState(false);
        const audioRef = useRef<HTMLAudioElement | null>(null);
        const pcRef = useRef<RTCPeerConnection | null>(null);
        const streamRef = useRef<MediaStream | null>(null);
        const dcRef = useRef<RTCDataChannel | null>(null);

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
                        if (data.type === "input_audio_stream_started") {
                            setIsListening(true);
                        } else if (data.type === "input_audio_stream_ended") {
                            setIsListening(false);

                            // Process the transcript when voice input ends
                            if (data.transcript) {
                                const transcript = data.transcript;
                                console.log("Processing transcript:", transcript);

                                // Call API endpoint to process the transcript instead of directly using server modules
                                fetch('/api/voice/process', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        transcript,
                                        userId: 'default-user' // You can add actual user ID if available
                                    }),
                                })
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data.responseText) {
                                            // Send the response back through the data channel
                                            if (dcRef.current && dcRef.current.readyState === 'open') {
                                                dcRef.current.send(JSON.stringify({
                                                    type: "text_to_speech",
                                                    text: data.responseText
                                                }));
                                            }
                                        } else {
                                            throw new Error('No response text received');
                                        }
                                    })
                                    .catch(error => {
                                        console.error("Error processing voice input:", error);

                                        // Send an error response
                                        if (dcRef.current && dcRef.current.readyState === 'open') {
                                            dcRef.current.send(JSON.stringify({
                                                type: "text_to_speech",
                                                text: "I'm sorry, I encountered an error while processing your request. Please try again."
                                            }));
                                        }
                                    });
                            }
                        } else if (data.type === "output_audio_stream_started") {
                            setIsSpeaking(true);
                        } else if (data.type === "output_audio_stream_ended") {
                            setIsSpeaking(false);
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
