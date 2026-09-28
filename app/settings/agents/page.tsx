import type { Metadata } from "next";
import { AgentSettings } from "@/features/settings/agents/agent-settings";

export const metadata: Metadata = { title: "AI agents · Atelio settings" };

export default function Page() {
  return <AgentSettings />;
}
