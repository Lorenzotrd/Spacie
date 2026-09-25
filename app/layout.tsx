import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Spacie — Your shared space",
  description: "The collaborative filesystem for humans and AI agents.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
