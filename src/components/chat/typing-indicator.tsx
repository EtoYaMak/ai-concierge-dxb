import React from "react";

export const TypingIndicator = () => {
    return (
        <div className="flex space-x-1 p-2">
            <div className="animate-bounce delay-0 w-2 h-2 bg-primary rounded-full"></div>
            <div className="animate-bounce delay-150 w-2 h-2 bg-primary rounded-full"></div>
            <div className="animate-bounce delay-300 w-2 h-2 bg-primary rounded-full"></div>
        </div>
    );
}; 