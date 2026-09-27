import type { Metadata } from "next";
import { MembersSettings } from "@/features/settings/members/members-settings";

export const metadata: Metadata = { title: "Members · Spacie settings" };

export default function Page() {
  return <MembersSettings />;
}
