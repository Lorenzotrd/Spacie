import type { Metadata } from "next";
import { PublicShare } from "@/features/public/public-share";

export const metadata: Metadata = {
  title: "Shared with you · Spacie",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicShare token={token} />;
}
