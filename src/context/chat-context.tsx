"use client";

import React, { useState, createContext, useContext } from "react";
import { Message } from "@/shared/schema";

// Define the context type
interface ChatContextType {
    messages: Message[];
    addMessage: (message: Message) => void;
    updateMessage: (message: Message) => void;
}

// Create the context with a default value
const ChatContext = createContext<ChatContextType>({
    messages: [],
    addMessage: () => { },
    updateMessage: () => { },
});

// Hook to use the chat context
export const useChatContext = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
    const [messages, setMessages] = useState<Message[]>([]);

    const addMessage = (message: Message) => {
        setMessages((prev) => [...prev, message]);
    };

    // New method to update an existing message
    const updateMessage = (updatedMessage: Message) => {
        setMessages((prev) =>
            prev.map((msg) =>
                msg.id === updatedMessage.id ? updatedMessage : msg
            )
        );
    };

    return (
        <ChatContext.Provider value={{ messages, addMessage, updateMessage }}>
            {children}
        </ChatContext.Provider>
    );
}; 