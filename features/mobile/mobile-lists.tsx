"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { ActivityList } from "@/features/rail/activity-list";
import { fileCount, formatBytes, relativeTime, storageUsed } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";

const card = "flex flex-col overflow-hidden rounded-2xl border border-[#eceae4] bg-card";
const row = "flex min-h-[60px] w-full items-center gap-3 border-b border-[#f3f1ed] px-3.5 text-left last:border-b-0";

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[18px] px-5 pt-7 pb-[110px]">
      <h1 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
      {children}
    </div>
  );
}

export function MobileProjects({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  return (
    <Screen title="Projects">
      <div className={card}>
        {state.projects.map((p) => (
          <button key={p.id} type="button" onClick={() => ctl.navigate(p.id)} className={row}>
            <span className="flex size-10 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
              <Box size={18} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">{p.name}</span>
              <span className="text-[13px] text-muted">
                {fileCount(state.files, p.id)}
              </span>
            </span>
            <ChevronRight size={18} className="text-[#a3a5ac]" aria-hidden />
          </button>
        ))}
        {!state.projects.length && <EmptyState title="No projects yet" />}
      </div>
      {(ctl.me?.role === "owner" || ctl.me?.role === "admin") && (
        <Button size="lg" className="h-12" onClick={() => ctl.dialog("project")}>
          New project
        </Button>
      )}
    </Screen>
  );
}

export function MobileActivity({ ctl }: { ctl: Controller }) {
  return (
    <Screen title="Activity">
      <div className="rounded-2xl border border-[#eceae4] bg-card p-4">
        <ActivityList state={ctl.state!} />
      </div>
    </Screen>
  );
}

export function MobileMe({ ctl }: { ctl: Controller }) {
  const router = useRouter();
  const state = ctl.state!;
  const trashed = state.files.filter((f) => f.deleted);
  return (
    <Screen title="Me">
      <div className="flex items-center gap-3">
        <Avatar person={ctl.me} size="lg" className="size-12 text-base" />
        <div className="flex flex-col">
          <span className="text-[17px] font-semibold">{ctl.me?.name}</span>
          <span className="text-[13px] text-muted capitalize">
            {ctl.me?.role} · {state.workspace.name} · {formatBytes(storageUsed(state.files))} stored
          </span>
        </div>
      </div>
      <div className={card}>
        <Link href="/settings/agents" className={`${row} text-ink no-underline`}>
          <span className="flex size-10 items-center justify-center rounded-[11px] bg-accent-soft text-accent">
            <AgentMark size={16} />
          </span>
          <span className="flex-1 text-[15px] font-medium">AI agents</span>
          <ChevronRight size={18} className="text-[#a3a5ac]" aria-hidden />
        </Link>
          <button
            type="button"
            className={row}
            onClick={() =>
              void fetch("/api/auth/logout", { method: "POST" }).then(
                (r) => (r.ok ? router.push("/login") : ctl.setError("Could not sign out. Try again.")),
                () => ctl.setError("Could not sign out. Try again."),
              )
            }
          >
            <span className="flex size-10 items-center justify-center rounded-[11px] bg-[#f1f0ec] text-ink-2">
              <LogOut size={18} aria-hidden />
            </span>
            <span className="flex-1 text-[15px] font-medium">Sign out</span>
          </button>
      </div>
      <h2 className="m-0 flex items-center gap-2 text-[17px] font-semibold">
        <Trash2 size={17} aria-hidden /> Trash
      </h2>
      <div className={card}>
        {trashed.map((f) => (
          <div key={f.id} className={row}>
            <FileIcon file={f} size="md" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">{f.name}</span>
              <span className="text-[13px] text-muted">{relativeTime(f.updatedAt)}</span>
            </span>
            <Button size="lg" className="h-11" onClick={() => void ctl.mutate({ action: "restore_file", id: f.id }).catch(() => undefined)}>
              Restore
            </Button>
          </div>
        ))}
        {!trashed.length && <EmptyState title="Trash is empty" />}
      </div>
    </Screen>
  );
}
