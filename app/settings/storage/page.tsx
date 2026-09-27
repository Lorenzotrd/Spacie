import type { Metadata } from "next";
import { StorageSettings } from "@/features/settings/storage/storage-settings";

export const metadata: Metadata = { title: "Storage and backups · Spacie settings" };

export default function Page() {
  return <StorageSettings />;
}
