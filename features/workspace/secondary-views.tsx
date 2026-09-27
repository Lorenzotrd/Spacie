"use client";
import { Box, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ActivityList } from "@/features/rail/activity-list";
import { fileCount, principalById, relativeTime } from "./derive";
import { FileIcon } from "./file-icon";
import type { Controller } from "./use-controller";

function Page({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-7 pb-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em]">{title}</h1>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

const row = "flex min-h-[58px] w-full items-center gap-3 border-b border-[#f3f1ed] px-4 text-left text-[13px] last:border-b-0";

export function HomeView({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  const recent = state.files.filter((f) => !f.deleted).slice(0, 6);
  return (
    <Page title={`Welcome back, ${ctl.me?.name ?? "teammate"}`} hint="Pick up where you left off.">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {state.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => ctl.navigate(p.id)}
            className="flex flex-col items-start gap-4 rounded-card border border-line-soft bg-card p-4 text-left hover:border-line"
          >
            <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-accent-soft text-accent">
              <Box size={18} aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-muted">
                {fileCount(state.files, p.id)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <h2 className="m-0 text-[17px] font-semibold">Recent files</h2>
      <Card className="overflow-hidden">
        {recent.map((f) => (
          <button key={f.id} type="button" onClick={() => ctl.openFile(f)} className={`${row} hover:bg-subtle`}>
            <FileIcon file={f} />
            <span className="flex-1 truncate font-medium">{f.name}</span>
            <span className="text-muted">
              {principalById(state, f.updatedBy)?.name} · {relativeTime(f.updatedAt)}
            </span>
          </button>
        ))}
        {!recent.length && <EmptyState title="No files yet" hint="Open a project to create or upload one." />}
      </Card>
    </Page>
  );
}

export function ActivityView({ ctl }: { ctl: Controller }) {
  return (
    <Page title="Activity" hint="Everything people and agents did across your workspace.">
      <Card className="max-w-2xl p-5">
        <ActivityList state={ctl.state!} />
      </Card>
    </Page>
  );
}

export function TrashView({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  const trashed = state.files.filter((f) => f.deleted);
  return (
    <Page title="Trash" hint="Deleted files can be restored with their history intact.">
      <Card className="overflow-hidden">
        {trashed.map((f) => (
          <div key={f.id} className={row}>
            <FileIcon file={f} />
            <span className="flex-1 truncate font-medium">{f.name}</span>
            <span className="text-muted">{relativeTime(f.updatedAt)}</span>
            <Button size="sm" onClick={() => void ctl.mutate({ action: "restore_file", id: f.id }).catch(() => undefined)}>
              Restore
            </Button>
          </div>
        ))}
        {!trashed.length && <EmptyState icon={<Trash2 size={18} />} title="Trash is empty" />}
      </Card>
    </Page>
  );
}
