"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Message } from "@/shared/schema";
import { useChatContext } from "@/context/chat-context";

interface ChatInputProps {
  userId: string | null;
}

export default function ChatInput({ userId }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const { addMessage, updateMessage } = useChatContext();
  const [updateCounter, setUpdateCounter] = useState(0);

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content,
            user_id: userId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API error:', errorData);
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", userId] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !userId) return;

    // Get the message content and clear input immediately
    const messageContent = message.trim();
    setMessage("");

    // Add user message to chat IMMEDIATELY
    const messageId = Date.now();
    const userMessageObj: Message = {
      id: messageId,
      content: messageContent,
      role: "user",
      user_id: userId,
      timestamp: new Date(),
    };

    // Add typing indicator message IMMEDIATELY
    const aiMessageObj: Message = {
      id: messageId + 1,
      content: "",
      role: "assistant",
      user_id: userId,
      timestamp: new Date(Date.now() + 1),
      isStreaming: true,
    };

    // Force immediate update to UI with both messages
    addMessage(userMessageObj);
    addMessage(aiMessageObj);

    // THEN start the API call separately
    fetchStreamResponse(messageContent, aiMessageObj);
  };

  // Separate function for the API call
  const fetchStreamResponse = async (messageContent: string, aiMessageObj: Message) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent, user_id: userId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partialResponse += chunk;

        updateMessage({
          ...aiMessageObj,
          content: partialResponse,
        });
      }

      updateMessage({
        ...aiMessageObj,
        content: partialResponse,
        isStreaming: false,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/messages", userId] });
    } catch (error) {
      console.error("Error sending message:", error);

      updateMessage({
        ...aiMessageObj,
        content: "Sorry, I encountered an error. Please try again.",
        isStreaming: false,
      });

      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about any activities or events..."
        className="min-h-[60px] resize-none"
        disabled={isLoading}
      />
      <Button
        type="submit"
        disabled={isLoading || !message.trim() || !userId}
        className="px-4 sm:px-8 h-10 sm:min-h-[62px] w-full sm:w-24"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Send"
        )}
      </Button>
    </form>
  );
}
