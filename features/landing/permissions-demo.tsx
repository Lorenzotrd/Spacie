"use client";
import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { AgentTile } from "./parts";

type Role = "read" | "comment" | "edit";
const ROLES: { id: Role; label: string }[] = [
  { id: "read", label: "Read" },
  { id: "comment", label: "Comment" },
  { id: "edit", label: "Edit" },
];

/** A working miniature of Settings > AI agents: pick a level, allow public links. */
export function PermissionsDemo() {
  const [role, setRole] = useState<Role>("comment");
  const [links, setLinks] = useState(false);
  return (
    <div className="flex flex-col gap-3 rounded-[14px] bg-[#faf9f6] p-3.5 md:rounded-2xl">
      <div className="flex items-center gap-2.5">
        <AgentTile name="Codex" size={30} />
        <span className="flex-1 text-sm font-semibold">Codex</span>
        <span className="rounded-full bg-success-soft px-2 py-[3px] text-[11px] font-semibold text-success">Connected</span>
      </div>
      <Tabs label="What Codex can do (demo)" items={ROLES} value={role} onChange={setRole} stretch className="bg-[#eceae4]" />
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[13px] text-ink-2">Can create public links</span>
        <Toggle checked={links} onChange={setLinks} label="Can create public links (demo)" />
      </div>
    </div>
  );
}
