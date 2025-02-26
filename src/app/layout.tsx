// This must be a server component (no "use client" directive)
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { AppInitializer } from "@/components/AppInitializer";
import { initializeApp } from '@/app/api/init';
import { ChatProvider } from "@/context/chat-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dubai AI Concierge",
  description: "Your personal guide to Dubai",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize here inside the component
  try {
    await initializeApp();
    console.log("✓ App initialized in layout");
  } catch (error) {
    console.error("⚠️ Failed to initialize app:", error);
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <ToastProvider>
            <ChatProvider>
              <AppInitializer />
              {children}
            </ChatProvider>
          </ToastProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
