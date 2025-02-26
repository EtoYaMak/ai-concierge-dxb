"use client";

import { useQuery } from "@tanstack/react-query";
import { type Message } from "@/shared/schema";
import MessageItem from "./message-item";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatMessagesProps {
  userId: string | null;
}

export default function ChatMessages({ userId }: ChatMessagesProps) {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", userId],
    queryFn: async () => {
      if (!userId) return [];

      try {
        // Ensure userId is properly encoded in the URL
        const url = new URL("/api/messages", window.location.origin);
        url.searchParams.append("user_id", userId);

        const response = await fetch(url.toString());

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error("Error fetching messages:", response.status, errorData);
          throw new Error(`Failed to fetch messages: ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        throw error;
      }
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[100px]" />
        ))}
      </div>
    );
  }

  if (!messages?.length) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <h3 className="text-lg font-medium mb-2">Welcome to Dubai Concierge!</h3>
        <p className="text-sm">Ask me anything about tourist attractions, dining, or activities in Dubai.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}