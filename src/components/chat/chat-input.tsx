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

  const sendStreamMessage = async (message: string) => {
    if (!userId) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/messages/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message, user_id: userId }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const messageId = Date.now();

      const userMessageObj: Message = {
        id: messageId,
        content: message,
        role: "user",
        user_id: userId,
        timestamp: new Date(),
      };

      addMessage(userMessageObj);

      const aiMessageObj: Message = {
        id: messageId + 1,
        content: "",
        role: "assistant",
        user_id: userId,
        timestamp: new Date(),
        isStreaming: true,
      };

      addMessage(aiMessageObj);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        partialResponse += chunk;

        const updatedAiMessage = {
          ...aiMessageObj,
          content: partialResponse,
        };

        updateMessage(updatedAiMessage);
        setUpdateCounter(prev => prev + 1);
      }

      const finalMessage = {
        ...aiMessageObj,
        content: partialResponse,
        isStreaming: false,
      };
      updateMessage(finalMessage);

      queryClient.invalidateQueries({ queryKey: ["/api/messages", userId] });
      setIsLoading(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !userId) return;

    sendStreamMessage(message.trim());
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask about tourist attractions..."
        className="min-h-[60px] resize-none"
        disabled={isLoading}
      />
      <Button
        type="submit"
        disabled={isLoading || !message.trim() || !userId}
        className="px-8 min-h-[60px]"
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
