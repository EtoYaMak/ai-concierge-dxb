"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import ChatMessages from "@/components/chat/chat-messages";
import ChatInput from "@/components/chat/chat-input";
import { UserIdentifier } from "@/components/UserIdentifier";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/theme-toggle";
import { LogOut } from "lucide-react";
export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  const handleLogout = async () => {
    if (userId) {
      try {
        // Delete user messages from the database
        await fetch(`/api/messages?user_id=${userId}`, {
          method: 'DELETE',
        });

        // Clear local storage and state
        localStorage.removeItem("chatUserId");
        setUserId(null);
        window.location.reload();
        // Redirect to login page
        router.push("/login");
      } catch (error) {
        console.error("Failed to delete messages:", error);
        // Continue with logout even if deletion fails
        localStorage.removeItem("chatUserId");
        setUserId(null);
        router.push("/login");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-t from-primary/30 to-primary/20 flex items-center justify-center sm:p-4">
      <UserIdentifier onUserIdSet={setUserId} />
      <Card className="w-full max-w-4xl h-screen sm:h-[94vh] flex flex-col rounded-lg">
        <div className="px-3 sm:px-6 py-2 border-b bg-card rounded-lg">
          <span className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Concierge
            </h1>
            {userId && (
              <span className="text-sm sm:text-base font-bold flex justify-center items-center gap-2">
                {userId.split('@')[0]}
              </span>
            )}
            <span className="flex justify-center items-center gap-2">
              <ModeToggle />

              {userId && (
                <span className="flex justify-center items-center">
                  <Button
                    className="text-white text-sm sm:text-base font-bold h-8 w-8 sm:h-10 sm:w-10 p-0"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </span>
              )}
            </span>
          </span>
        </div>

        <ScrollArea className="flex-1 px-2 sm:px-4 py-0">
          <div className="max-w-full sm:max-w-[95%] mx-auto py-0 sm:py-2">
            <ChatMessages userId={userId} />
          </div>
        </ScrollArea>

        <div className="px-2 sm:px-4 py-2 border-t bg-card/50 rounded-b-lg">
          <ChatInput userId={userId} />
        </div>
      </Card>
    </div>
  );
}