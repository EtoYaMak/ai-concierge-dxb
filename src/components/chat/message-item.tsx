"use client";

import { type Message } from "@/shared/schema";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { TypingIndicator } from "@/components/chat/typing-indicator";

interface MessageItemProps {
  message: Message;
}

export default function MessageItem({ message }: MessageItemProps) {
  const isBot = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg p-4",
        isBot ? "bg-muted/50 border border-border/50" : "bg-primary/5"
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isBot ? "bg-primary" : "bg-primary/20"
        )}
      >
        {isBot ? (
          <Bot className="h-4 w-4 text-primary-foreground" />
        ) : (
          <User className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="font-medium text-sm">
          {isBot ? "Dubai Concierge" : "You"}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none [&>p:last-child]:mb-0">
          <div className="whitespace-pre-wrap">
            {message.isStreaming && message.content === "" ? (
              <TypingIndicator />
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}