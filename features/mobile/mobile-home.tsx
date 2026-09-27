"use client";
import { ArrowRight, Box, ChevronRight, Plus } from "lucide-react";
import { AgentMark } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { SearchBox } from "@/features/shell/search-box";
import { fileCount, latestAgentAction, principalById, relativeTime } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";

const RECENT = 5;

export function MobileHome({ ctl, onPerson }: { ctl: Controller; onPerson: (id: string) => void }) {
  const state = ctl.state!;
  const recent = state.files.filter((f) => !f.deleted).slice(0, RECENT);
  // The newest agent action across every project the person can see.
  const latest = state.projects
    .map((p) => latestAgentAction(state, p.id))
    .filter((x) => x !== null)
    .sort((a, b) => Date.parse(b.event.createdAt) - Date.parse(a.event.createdAt))[0];
  const canCreate = ctl.me?.role === "owner" || ctl.me?.role === "admin";
  const whoLabel = (id: string) => (id === state.currentPrincipalId ? "You" : principalById(state, id)?.name ?? "Someone");

  return (
    <div className="flex flex-col gap-[22px] px-5 pt-7 pb-[110px]">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-muted">{state.workspace.name}</span>
          <h1 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">Hi {ctl.me?.name ?? "there"}</h1>
        </div>
        <span aria-hidden className="flex size-11 items-center justify-center rounded-xl bg-ink text-base font-bold text-white">
          {state.workspace.name[0]?.toUpperCase()}
        </span>
      </div>
      <SearchBox state={state} onFile={ctl.openFile} onPerson={(p) => onPerson(p.id)} className="[&_label]:h-12 [&_label]:rounded-[14px] [&_input]:text-[15px] [&_kbd]:hidden" />
      {latest?.file && !latest.file.deleted && (
        <button
          type="button"
          onClick={() => ctl.openFile(latest.file!)}
          className="flex flex-col items-stretch gap-3.5 rounded-[18px] bg-accent p-4 text-left text-white"
        >
          <span className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-white/20">
              <AgentMark size={14} />
            </span>
            <span className="flex-1 text-[13px] font-medium">
              {latest.agent.name} · {relativeTime(latest.event.createdAt)}
            </span>
          </span>
          <span className="text-[17px] leading-snug font-semibold">
            {latest.event.action[0].toUpperCase() + latest.event.action.slice(1)} {latest.event.name}
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {latest.file.version > 1 ? "See what changed" : "Open file"}
            <ArrowRight size={16} aria-hidden />
          </span>
        </button>
      )}
      <section className="flex flex-col gap-3">
        <div className="flex items-center">
          <h2 className="m-0 flex-1 text-[17px] font-semibold">Projects</h2>
          <button type="button" onClick={() => ctl.setView("projects")} className="min-h-11 px-1 text-sm text-accent">
            See all
          </button>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {state.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ctl.navigate(p.id)}
              className="flex w-[200px] shrink-0 flex-col items-start gap-[18px] rounded-2xl border border-[#eceae4] bg-card p-4 text-left"
            >
              <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-accent-soft text-accent">
                <Box size={18} aria-hidden />
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="truncate text-[15px] font-semibold">{p.name}</span>
                <span className="text-[13px] text-muted">
                  {fileCount(state.files, p.id)}
                </span>
              </span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => ctl.dialog("project")}
              className="flex w-[130px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[#d6d3cb] text-sm text-[#55575f]"
            >
              <Plus size={20} aria-hidden />
              New project
            </button>
          )}
        </div>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="m-0 pb-2 text-[17px] font-semibold">Recent</h2>
        {recent.map((f) => (
          <button key={f.id} type="button" onClick={() => ctl.openFile(f)} className="flex min-h-[60px] items-center gap-3 text-left">
            <FileIcon file={f} size="md" className="bg-[#f1f0ec]" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-medium">{f.name}</span>
              <span className="text-[13px] text-muted">
                {whoLabel(f.updatedBy)} · {relativeTime(f.updatedAt)}
              </span>
            </span>
            <ChevronRight size={18} className="text-[#a3a5ac]" aria-hidden />
          </button>
        ))}
        {!recent.length && <EmptyState title="No files yet" hint="Tap + to add a photo, a PDF or a document." />}
      </section>
    </div>
  );
}
