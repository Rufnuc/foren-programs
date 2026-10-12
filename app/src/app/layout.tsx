import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prutet",
  description:
    "Privacy-first evidence vault. Capture, encrypt, and anchor evidence to Solana without revealing your identity.",
  manifest: "/manifest.webmanifest",
  applicationName: "Prutet",
};

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-ink antialiased min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
