import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DataProvider } from "@/lib/data-context";

export const metadata: Metadata = {
  title: "encore — your year in sound",
  description: "A deeper, prettier Wrapped built from your Spotify extended streaming history. Runs entirely in your browser.",
};

export const viewport: Viewport = { themeColor: "#0d0d10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
