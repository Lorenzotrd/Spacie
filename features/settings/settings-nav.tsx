import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Principal } from "@/lib/types";
import { Avatar, AgentMark } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/card";

/** Settings sidebar. Only sections that exist are listed. */
export function SettingsNav({ me, workspace, agentCount }: { me: Principal | undefined; workspace: string; agentCount: number }) {
  return (
    <aside className="flex shrink-0 flex-col gap-5 px-1.5 pt-2.5 pb-1.5 md:w-64">
      <Link href="/workspace" className="flex h-11 items-center gap-2 rounded-control px-2.5 text-sm text-ink-2 no-underline hover:bg-card/70">
        <ChevronLeft size={17} aria-hidden />
        Back to workspace
      </Link>
      <div className="flex items-center gap-2.5 px-2.5">
        <Avatar person={me} size="lg" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{me?.name}</span>
          <span className="text-xs text-muted capitalize">
            {me?.role ?? "member"} · {workspace}
          </span>
        </div>
      </div>
      <nav aria-label="Settings" className="flex flex-col gap-0.5">
        <SectionLabel className="px-2.5 pb-1">Workspace</SectionLabel>
        <Link
          href="/settings/agents"
          aria-current="page"
          className="flex h-[38px] items-center gap-2.5 rounded-control border border-line bg-card px-2.5 text-sm font-medium text-accent-hover no-underline"
        >
          <AgentMark size={15} />
          <span className="flex-1">AI agents</span>
          {agentCount > 0 && <Badge tone="count">{agentCount}</Badge>}
        </Link>
      </nav>
    </aside>
  );
}
