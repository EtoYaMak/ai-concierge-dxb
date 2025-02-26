"use client";

import * as React from "react";

type ToastProps = {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
};

type ToastContextType = {
    toast: (props: ToastProps) => void;
};

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const toast = React.useCallback(({ title, description, variant }: ToastProps) => {
        // For simplicity, just log to console
        // In a real app, you'd use a toast component library
        console.log(`[Toast ${variant || "default"}] ${title}: ${description}`);
        // Add real toast implementation here
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = React.useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
} 