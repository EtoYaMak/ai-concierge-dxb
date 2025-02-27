"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MessageItem from "./message-item";
import { useChatContext } from "@/context/chat-context";
import { type Message } from "@/shared/schema";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface ChatMessagesProps {
  userId: string | null;
}

export default function ChatMessages({ userId }: ChatMessagesProps) {
  const { messages, addMessage } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if user is at bottom
  const checkIsAtBottom = () => {
    // Use the closest scrollable ancestor (the ScrollArea from page.tsx)
    const scrollContainer = containerRef.current?.closest('.scroll-area') ||
      containerRef.current?.closest('[data-radix-scroll-area-viewport]');

    if (!scrollContainer) return;

    // Increase the threshold to prevent minor scroll differences from showing the button
    const isAtBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 50;
    setIsAtBottom(isAtBottom);
  };

  // Initialize isAtBottom on first render and when messages change
  useEffect(() => {
    checkIsAtBottom();
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  // Add scroll event listener to the ScrollArea component
  useEffect(() => {
    // Find the scrollable element (ScrollArea viewport)
    const scrollContainer = containerRef.current?.closest('.scroll-area') ||
      containerRef.current?.closest('[data-radix-scroll-area-viewport]');

    if (!scrollContainer) return;

    scrollContainer.addEventListener("scroll", checkIsAtBottom);
    return () => {
      scrollContainer.removeEventListener("scroll", checkIsAtBottom);
    };
  }, []);

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

  // Log isAtBottom state for debugging
  useEffect(() => {
    console.log("Is at bottom:", isAtBottom);
  }, [isAtBottom]);

  if (!userId) {
    return <div className="p-8 text-center">Please log in to start chatting.</div>;
  }

  if (isLoading && messages.length === 0) {
    return <div className="p-8 text-center">Loading messages...</div>;
  }

  // Use context messages for rendering
  return (
    <div className="relative" ref={containerRef}>
      <div className="space-y-4 py-5">
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

      {!isAtBottom && messages.length > 0 && (
        <Button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-1/2 rounded-full p-2 shadow-md z-10 opacity-20 hover:opacity-100 transition-opacity duration-300"
          size="icon"
          variant="default"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}