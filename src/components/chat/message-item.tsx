"use client";

import { type Message } from "@/shared/schema";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
              h1: ({ children }) => <h1 className="text-lg font-bold mb-3">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-medium mb-2">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
              em: ({ children }) => <em className="italic text-primary/90">{children}</em>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}