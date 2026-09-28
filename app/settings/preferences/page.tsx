import type { Metadata } from "next";
import { PreferencesSettings } from "@/features/settings/preferences/preferences-settings";

export const metadata: Metadata = { title: "Preferences · Atelio settings" };

export default function Page() {
  return <PreferencesSettings />;
}
