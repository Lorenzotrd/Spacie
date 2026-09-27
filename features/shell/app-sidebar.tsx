"use client";
import Link from "next/link";
import { Activity, Folder, House, Plus, Settings, Trash2, type LucideIcon } from "lucide-react";
import type { PresenceEntry } from "@/lib/presence";
import type { Principal, PublicState } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { formatBytes, storageUsed } from "@/features/workspace/derive";
import type { View } from "@/features/workspace/use-controller";
import { Brand } from "./brand";
import { WorkspaceSwitcher } from "./workspace-switcher";

type Props = {
  state: PublicState;
  project: string;
  folder: string | null;
  view: View;
  presence: PresenceEntry[];
  me: Principal | undefined;
  navigate: (projectId: string, folderId?: string | null) => void;
  setView: (view: View) => void;
  onNewProject: () => void;
  onPerson: (person: Principal) => void;
  onWorkspaceChanged: () => Promise<void>;
  onError: (message: string) => void;
};

const navItem = "flex h-[2.375rem] items-center gap-2.5 rounded-control px-2.5 text-sm text-ink-2 hover:bg-card/70";

function NavButton({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(navItem, "w-full text-left", active && "bg-card font-medium text-accent-hover")}
    >
      <Icon size={17} strokeWidth={1.8} aria-hidden />
      <span className="flex-1">{label}</span>
    </button>
  );
}

export function AppSidebar({
  state, project, folder, view, presence, me, navigate, setView, onNewProject, onPerson, onWorkspaceChanged, onError,
}: Props) {
  const online = new Set(presence.map((p) => p.principalId));
  const humans = state.principals.filter((p) => p.type === "human");
  // Disconnected agents keep their history but leave the sidebar.
  const agents = state.principals.filter((p) => p.type === "agent" && p.status !== "offline");
  const canManage = me?.role === "owner" || me?.role === "admin";
  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto px-1.5 pt-2.5 pb-1.5">
      <Brand />
      <WorkspaceSwitcher current={state.workspace} onChanged={onWorkspaceChanged} onError={onError} />
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <NavButton icon={House} label="Home" active={view === "home"} onClick={() => setView("home")} />
        <NavButton icon={Activity} label="Activity" active={view === "activity"} onClick={() => setView("activity")} />
        <NavButton icon={Trash2} label="Trash" active={view === "trash"} onClick={() => setView("trash")} />
      </nav>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center px-2.5">
          <SectionLabel className="flex-1">Projects</SectionLabel>
          {canManage && (
            <IconButton label="New project" size="sm" onClick={onNewProject}>
              <Plus size={14} />
            </IconButton>
          )}
        </div>
        {state.projects.map((p) => {
          const active = p.id === project && view === "space";
          const count = state.files.filter((f) => f.projectId === p.id && !f.deleted).length;
          return (
            <div key={p.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => navigate(p.id)}
                aria-current={active && !folder ? "page" : undefined}
                className={cn(
                  navItem,
                  "w-full border border-transparent text-left",
                  active && "border-line bg-card font-medium text-accent-hover",
                )}
              >
                <span aria-hidden className="size-2 rounded-[0.1875rem]" style={{ background: p.color }} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="font-mono text-[0.6875rem] text-muted">{count}</span>
              </button>
              {p.id === project &&
                state.folders
                  .filter((f) => f.projectId === p.id && !f.parentId)
                  .map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => navigate(p.id, f.id)}
                      aria-current={folder === f.id && view === "space" ? "page" : undefined}
                      className={cn(
                        "flex h-[2.125rem] w-full items-center gap-2.5 rounded-control pr-2.5 pl-7 text-left text-[0.8125rem] text-ink-2 hover:bg-card/70",
                        folder === f.id && view === "space" && "font-medium text-accent-hover",
                      )}
                    >
                      <Folder size={15} strokeWidth={1.8} aria-hidden />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
            </div>
          );
        })}
        {!state.projects.length && <p className="px-2.5 text-[0.8125rem] text-muted">No projects yet.</p>}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel className="px-2.5 pb-0.5">Team</SectionLabel>
        {humans.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => onPerson(p)}
            className={cn(navItem, "w-full text-left")}
          >
            <Avatar person={p} size="sm" />
            <span className="flex-1 truncate">{p.name}</span>
            {(online.has(p.id) || p.id === state.currentPrincipalId) && (
              <span className="size-[0.4375rem] rounded-full bg-online" role="img" aria-label="Online" />
            )}
          </button>
        ))}
        {agents.map((p) => (
          <Link key={p.id} href={`/settings/agents?agent=${p.id}`} className={cn(navItem, "no-underline")}>
            <Avatar person={p} size="sm" />
            <span className="flex-1 truncate text-ink-2">{p.name}</span>
            <Badge tone="neutral">AI</Badge>
          </Link>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3.5">
          <div className="flex text-xs text-muted">
            <span className="flex-1">Storage</span>
            <span className="font-medium text-ink">{formatBytes(storageUsed(state.files))}</span>
          </div>
          <span className="text-[0.6875rem] text-muted">{state.demo ? "Local demo" : "Workspace"}</span>
        </div>
        <Link
          href="/settings/agents"
          aria-label="Account and AI agent settings"
          className="flex items-center gap-2.5 rounded-control p-2 text-ink no-underline hover:bg-card/70"
        >
          <Avatar person={me} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{me?.name}</span>
            <span className="text-xs text-muted capitalize">{me?.role ?? "Member"}</span>
          </span>
          <Settings size={16} className="text-muted" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
