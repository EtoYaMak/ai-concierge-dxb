"use client";

import { useEffect } from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { initializeApp } from "./api/init";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dubai Concierge",
  description: "Your personal guide to Dubai's finest experiences",
};

function AppInitializer() {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <ToastProvider>
            <AppInitializer />
            {children}
          </ToastProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
