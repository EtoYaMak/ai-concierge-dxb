"use client";

import { type Message } from "@/shared/schema";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import remarkGfm from "remark-gfm";

interface MessageItemProps {
  message: Message;
  userId: string;
}

export default function MessageItem({ message, userId }: MessageItemProps) {
  const isBot = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex sm:flex-row flex-col sm:gap-3 gap-0 rounded-lg px-4 pb-1 pt-3 sm:py-3",
        isBot ? "bg-primary/5 border border-primary/50" : "bg-muted/50"
      )}
    >
      <span className="flex items-center sm:items-start gap-2">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            isBot ? "bg-primary" : "bg-primary/20"
          )}
        >
          {isBot ? (
            <Bot className="h-6 w-6 text-primary-foreground" />
          ) : (
            <User className="h-6 w-6 text-primary" />
          )}


        </div>
        <div className="font-medium text-sm block sm:hidden">
          {isBot ? "Concierge" : `${userId}`}
        </div>
      </span>
      <div className="flex-1">
        <div className="font-medium text-sm hidden sm:block capitalize">
          {isBot ? "Concierge" : `${userId.split("@")[0]}`}
        </div>
        <div className="markdown [&>hr]:my-2 [&>p]:my-2 [&>h2]:mb-1 [&>h2]:mt-2 [&>h3]:mb-1 [&>h3]:mt-2 [&>ul]:my-1 [&>li]:my-0.5">
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
                ul: ({ children }) => <ul className="my-1 list-none pl-2 sm:pl-5">{children}</ul>,
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