"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const [userId, setUserId] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!userId.trim()) {
            alert("Please enter a user ID");
            return;
        }

        // Store user ID in localStorage - same as your existing system
        localStorage.setItem("chatUserId", userId);

        // Redirect to main chat page
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-700 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        Dubai AI Concierge
                    </CardTitle>
                    <CardDescription>
                        Your personal guide to Dubai&apos;s finest experiences
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="userId">Enter your User ID</Label>
                            <Input
                                id="userId"
                                placeholder="user123"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full">
                            Login
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
} 