"use client";

import { useEffect } from "react";
import { initializeApp } from "@/lib/init";

export function AppInitializer() {
    useEffect(() => {
        initializeApp()
            .then((success) => {
                if (success) {
                    console.log("App initialized successfully");
                } else {
                    console.warn("App initialization had some issues");
                }
            })
            .catch((error) => {
                console.error("Failed to initialize app:", error);
            });
    }, []);

    return null;
} 