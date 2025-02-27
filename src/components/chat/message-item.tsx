"use client";

import { type Message } from "@/shared/schema";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import remarkGfm from "remark-gfm";

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

      <div className="flex-1">
        <div className="font-medium text-sm">
          {isBot ? "Dubai Concierge" : "You"}
        </div>
        <div className="markdown [&>hr]:my-2 [&>p]:my-1 [&>h2]:mb-1 [&>h2]:mt-2 [&>h3]:mb-1 [&>h3]:mt-2 [&>ul]:my-1 [&>li]:my-0.5">
          {message.isStreaming && message.content === "" ? (
            <TypingIndicator />
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="my-1">{children}</p>,
                hr: () => <hr className="my-2" />,
                h2: ({ children }) => <h2 className="font-bold text-lg mt-2 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="font-bold text-md mt-2 mb-1">{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}