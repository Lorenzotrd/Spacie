import type { Metadata } from "next";
import { GeneralSettings } from "@/features/settings/general/general-settings";

export const metadata: Metadata = { title: "General · Atelio settings" };

export default function Page() {
  return <GeneralSettings />;
}
