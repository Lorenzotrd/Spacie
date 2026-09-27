import type { Metadata } from "next";
import { LinksSettings } from "@/features/settings/links/links-settings";

export const metadata: Metadata = { title: "Public links · Spacie settings" };

export default function Page() {
  return <LinksSettings />;
}
