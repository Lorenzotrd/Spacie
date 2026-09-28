"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Box, ChevronLeft, HardDrive, Link2, SlidersVertical, User, Users, type LucideIcon } from "lucide-react";
import type { Principal } from "@/lib/types";
import { Avatar, AgentMark } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

export type SettingsSection = "profile" | "preferences" | "general" | "members" | "agents" | "links" | "storage";

type Item = { id: SettingsSection; label: string; href: string; icon: LucideIcon | "agent" };
const ACCOUNT: Item[] = [
  { id: "profile", label: "Profile", href: "/settings/profile", icon: User },
  { id: "preferences", label: "Preferences", href: "/settings/preferences", icon: SlidersVertical },
];
const WORKSPACE: Item[] = [
  { id: "general", label: "General", href: "/settings/general", icon: Box },
  { id: "members", label: "Members", href: "/settings/members", icon: Users },
  { id: "agents", label: "AI agents", href: "/settings/agents", icon: "agent" },
  { id: "links", label: "Public links", href: "/settings/links", icon: Link2 },
  { id: "storage", label: "Storage and backups", href: "/settings/storage", icon: HardDrive },
];

/**
 * Settings sidebar; a scrolling row of chips on phones. Only sections backed by the
 * API are listed: Profile and Preferences need an account, General and Storage an owner or admin.
 */
export function SettingsNav({
  me,
  workspace,
  agentCount,
  section,
  hasAccount,
  canManage,
}: {
  me: Principal | undefined;
  workspace: string;
  agentCount: number;
  section: SettingsSection;
  hasAccount: boolean;
  canManage: boolean;
}) {
  const groups = [
    { title: "Account", items: hasAccount ? ACCOUNT : [] },
    { title: "Workspace", items: WORKSPACE.filter((i) => (i.id !== "storage" && i.id !== "general") || canManage) },
  ].filter((g) => g.items.length);
  // On phones the sections are a scrolling row: bring the open one into view.
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [section]);
  return (
    <aside className="flex shrink-0 flex-col gap-4 px-1.5 pt-2.5 pb-1.5 md:w-64 md:gap-[1.375rem]">
      <Link href="/workspace" className="flex h-11 items-center gap-2 rounded-control px-2.5 text-sm text-ink-2 no-underline hover:bg-card/70 md:h-[2.375rem]">
        <ChevronLeft size={17} aria-hidden />
        Back to workspace
      </Link>
      <div className="flex items-center gap-2.5 px-2.5">
        <Avatar person={me} size="lg" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{me?.name}</span>
          <span className="truncate text-xs text-muted">
            <span className="capitalize">{me?.role ?? "member"}</span> · {workspace}
          </span>
        </div>
      </div>
      <nav
        aria-label="Settings"
        className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-1 md:mx-0 md:flex-col md:gap-3.5 md:overflow-visible md:px-0 md:pb-0"
      >
        {groups.map((g) => (
          <div key={g.title} className="flex shrink-0 gap-1.5 md:flex-col md:gap-0.5">
            <SectionLabel className="hidden px-2.5 pb-1 md:block">{g.title}</SectionLabel>
            {g.items.map((item) => {
              const active = item.id === section;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  ref={active ? current : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2.5 rounded-control border px-3 text-sm whitespace-nowrap no-underline md:h-[2.375rem] md:px-2.5",
                    active
                      ? "border-line bg-card font-medium text-accent-hover"
                      : "border-transparent text-ink-2 hover:bg-card/70 max-md:border-line max-md:bg-card/60",
                  )}
                >
                  {Icon === "agent" ? <AgentMark size={15} /> : <Icon size={17} strokeWidth={1.8} aria-hidden />}
                  <span className="md:flex-1">{item.label}</span>
                  {item.id === "agents" && agentCount > 0 && <Badge tone="count">{agentCount}</Badge>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
