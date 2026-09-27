import type { Metadata } from "next";
import { ProfileSettings } from "@/features/settings/profile/profile-settings";

export const metadata: Metadata = { title: "Profile · Spacie settings" };

export default function Page() {
  return <ProfileSettings />;
}
