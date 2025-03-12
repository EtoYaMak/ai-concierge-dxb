"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import MessageItem from "@/components/chat/message-item";
import { useChatContext } from "@/context/chat-context";
import { type Message } from "@/shared/schema";

interface ChatMessagesProps {
  userId: string | null;
}

export default function ChatMessages({ userId }: ChatMessagesProps) {
  const { messages, addMessage } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Fetch messages from API
  const { data: apiMessages, isLoading } = useQuery({
    queryKey: ["/api/messages", userId],
    queryFn: async () => {
      if (!userId) return [];

      const response = await fetch(`/api/messages?user_id=${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json() as Promise<Message[]>;
    },
    enabled: !!userId,
  });

  // Sync API messages with context
  useEffect(() => {
    if (apiMessages && apiMessages.length > 0 && messages.length === 0) {
      // Only populate if context is empty
      apiMessages.forEach(msg => addMessage(msg));
    }
  }, [apiMessages, addMessage, messages.length]);

  // Add this logging
  useEffect(() => {
    console.log("Messages updated:", messages.length);
  }, [messages]);


  if (!userId) {
    return <div className="p-8 text-center">Please log in to start chatting.</div>;
  }

  if (isLoading && messages.length === 0) {
    return <div className="p-8 text-center">Loading messages...</div>;
  }

  // Use context messages for rendering
  return (
    <div className="relative">
      <div className="space-y-2 sm:space-y-4 py-5">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <MessageItem key={message.id} message={message} userId={userId} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

    </div>
  );
}