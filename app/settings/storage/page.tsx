import type { Metadata } from "next";
import { StorageSettings } from "@/features/settings/storage/storage-settings";

export const metadata: Metadata = { title: "Storage and backups · Atelio settings" };

export default function Page() {
  return <StorageSettings />;
}
