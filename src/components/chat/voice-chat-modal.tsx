// src/components/chat/voice-modal.tsx

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import RealTimeVoiceAssistant, { VoiceAssistantHandle } from "@/components/chat/voice-assistant";
import { cn } from "@/lib/utils";

interface VoiceModalProps {
    onClose: () => void;
}

export default function VoiceModal({ onClose }: VoiceModalProps) {
    const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking'>('idle');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    // Ref to the voice assistant component
    const voiceAssistantRef = useRef<VoiceAssistantHandle>(null);

    // Function to receive state updates from the voice assistant
    const handleStateChange = (newState: 'idle' | 'listening' | 'speaking') => {
        setVoiceState(newState);
    };

    // Simple audio visualization with random bars
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas dimensions
        canvas.width = 300;
        canvas.height = 150;

        const barWidth = 4;
        const barSpacing = 1;
        const barCount = Math.floor(canvas.width / (barWidth + barSpacing));
        const barHeightMultiplier = 0.7;

        // Animation function for the visualizer
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Different animation patterns based on state
            for (let i = 0; i < barCount; i++) {
                let barHeight = 0;

                if (voiceState === 'listening') {
                    // More active when listening (microphone input)
                    barHeight = Math.random() * 40 + 10;
                } else if (voiceState === 'speaking') {
                    // Rhythmic pattern when AI is speaking
                    barHeight = Math.sin(Date.now() * 0.003 + i * 0.15) * 25 + 40;
                } else {
                    // Subtle movement when idle
                    barHeight = Math.sin(Date.now() * 0.001 + i * 0.1) * 5 + 10;
                }

                // Gradient color based on state
                let gradient;
                if (voiceState === 'listening') {
                    gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    gradient.addColorStop(0, '#10b981'); // Green
                    gradient.addColorStop(1, '#059669');
                } else if (voiceState === 'speaking') {
                    gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    gradient.addColorStop(0, '#3b82f6'); // Blue
                    gradient.addColorStop(1, '#2563eb');
                } else {
                    gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    gradient.addColorStop(0, '#6b7280'); // Gray
                    gradient.addColorStop(1, '#4b5563');
                }

                ctx.fillStyle = gradient;

                // Center the bars horizontally
                const x = i * (barWidth + barSpacing) + (canvas.width - barCount * (barWidth + barSpacing)) / 2;
                const y = canvas.height - barHeight * barHeightMultiplier;

                // Draw rounded bars
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barHeight * barHeightMultiplier, 2);
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        // Start the animation
        animationRef.current = requestAnimationFrame(animate);

        // Cleanup animation on unmount
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [voiceState]);

    // Handle stopping the voice assistant and closing the modal
    const handleStop = () => {
        if (voiceAssistantRef.current) {
            voiceAssistantRef.current.cleanup();
        }
        onClose();
    };

    // Handle starting/stopping the voice assistant
    const handleToggle = () => {
        if (voiceAssistantRef.current) {
            voiceAssistantRef.current.toggleListening();
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 p-8 rounded-xl flex flex-col items-center gap-6 shadow-2xl max-w-md w-full border border-gray-800">
                <div className="w-full flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Voice Assistant</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full text-gray-400 hover:text-white hover:bg-gray-800"
                    >
                        <X size={20} />
                    </Button>
                </div>

                <div className="flex flex-col items-center justify-center w-full gap-6">
                    {/* Audio Visualization */}
                    <div className="relative">
                        <div className={cn(
                            "absolute -inset-1 rounded-full opacity-50 blur-md transition-all duration-300",
                            voiceState === 'listening' ? "bg-green-500" :
                                voiceState === 'speaking' ? "bg-blue-500" : "bg-gray-600"
                        )} />

                        <div className={cn(
                            "relative flex items-center justify-center w-32 h-32 rounded-full border-2 transition-colors duration-300",
                            voiceState === 'listening' ? "border-green-500 bg-green-500/10" :
                                voiceState === 'speaking' ? "border-blue-500 bg-blue-500/10" : "border-gray-600 bg-gray-600/10"
                        )}>
                            <div className="relative">
                                {/* Microphone or speaker icon depending on state */}
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={cn(
                                        "w-10 h-10 transition-colors duration-300",
                                        voiceState === 'listening' ? "text-green-500" :
                                            voiceState === 'speaking' ? "text-blue-500" : "text-gray-400"
                                    )}
                                >
                                    {voiceState === 'speaking' ? (
                                        // Speaker icon for speaking
                                        <>
                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                            <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18.94V21" />
                                        </>
                                    ) : (
                                        // Microphone icon for listening/idle
                                        <>
                                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                            <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18.94V21" />
                                        </>
                                    )}
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Canvas for audio visualization */}
                    <canvas
                        ref={canvasRef}
                        className="w-full h-24 rounded-md"
                    />

                    {/* Status indicator */}
                    <div className="text-center">
                        <p className={cn(
                            "text-xl font-medium transition-colors",
                            voiceState === 'listening' ? "text-green-500" :
                                voiceState === 'speaking' ? "text-blue-500" : "text-gray-400"
                        )}>
                            {voiceState === 'listening'
                                ? "Listening..."
                                : voiceState === 'speaking'
                                    ? "Speaking..."
                                    : "Waiting..."}
                        </p>
                    </div>

                    {/* Voice assistant component - hidden from UI but functional */}
                    <div className="sr-only">
                        <RealTimeVoiceAssistant
                            onStateChange={handleStateChange}
                            ref={voiceAssistantRef}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-2 w-full">
                        <Button
                            onClick={handleToggle}
                            variant={voiceState !== 'idle' ? "destructive" : "default"}
                            size="lg"
                            className="w-full"
                        >
                            {voiceState !== 'idle' ? "Stop" : "Start"} Voice
                        </Button>

                        <Button
                            onClick={handleStop}
                            variant="outline"
                            size="lg"
                            className="w-full text-gray-400 hover:text-white"
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}