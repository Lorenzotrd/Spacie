import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
/** Brand display face: the landing's h1/h2 only (the wordmark is an outlined SVG). */
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Atelio — Your shared space",
  description: "The collaborative filesystem for humans and AI agents.",
  applicationName: "Atelio",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};
/** Lets the mobile layout reach the screen edges and pad itself with the safe-area insets. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
