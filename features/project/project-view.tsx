"use client";
import { useState, type DragEvent } from "react";
import { ArrowDownUp, Grid2X2, List, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/components/ui/cn";
import { folderFiles, tabCounts, type FileTab } from "@/features/workspace/derive";
import type { Controller } from "@/features/workspace/use-controller";
import { AiBanner } from "./ai-banner";
import { FileTable } from "./file-table";
import { StatCards } from "./stat-cards";

const toggle = "flex size-[30px] items-center justify-center rounded-[7px]";

export function ProjectView({ ctl, onCompare }: { ctl: Controller; onCompare: (fileId: string) => void }) {
  const state = ctl.state!;
  const [dragging, setDragging] = useState(false);
  const place = { projectId: ctl.project, folderId: ctl.folder };
  const folders = state.folders
    .filter((f) => f.projectId === ctl.project && f.parentId === ctl.folder)
    .sort((a, b) => a.name.localeCompare(b.name));
  const counts = tabCounts(state.files, place, folders.length);
  const files = folderFiles(state.files, place, ctl.tab, ctl.sort);
  const tabs: { id: FileTab; label: string; count: number }[] = [
    { id: "all", label: "All files", count: counts.all },
    { id: "docs", label: "Documents", count: counts.docs },
    { id: "assets", label: "Assets", count: counts.assets },
  ];
  const openById = (id: string) => {
    const f = state.files.find((x) => x.id === id);
    if (f) ctl.openFile(f);
  };
  const showRail = (tab: "activity" | "versions") => {
    ctl.setRail(tab);
    ctl.setShowRail(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void ctl.uploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-7 pb-6", dragging && "bg-accent-tint/60")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em]">
          {ctl.currentFolder?.name ?? ctl.currentProject?.name}
        </h1>
        {!ctl.currentFolder && ctl.currentProject?.description && (
          <p className="text-sm text-muted">{ctl.currentProject.description}</p>
        )}
      </div>
      {!ctl.folder && (
        <>
          <AiBanner state={state} projectId={ctl.project} onCompare={onCompare} onOpen={openById} />
          <StatCards
            state={state}
            projectId={ctl.project}
            onFiles={() => ctl.setTab("all")}
            onVersions={() => showRail("versions")}
            onActivity={() => showRail("activity")}
          />
        </>
      )}
      <div className="flex items-center gap-2.5">
        <Tabs label="Filter files" items={tabs} value={ctl.tab} onChange={ctl.setTab} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => ctl.setSort(ctl.sort === "recent" ? "name" : "recent")}
            aria-label={`Sort: ${ctl.sort === "recent" ? "most recent" : "name"}. Click to change.`}
            className="font-normal text-ink-2"
          >
            <ArrowDownUp size={15} aria-hidden />
            Sort: {ctl.sort === "recent" ? "recent" : "name"}
          </Button>
          <div role="group" aria-label="Layout" className="flex gap-0.5 rounded-[9px] bg-segment p-[3px]">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={!ctl.grid}
              onClick={() => ctl.setGrid(false)}
              className={cn(toggle, !ctl.grid ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,24,28,0.08)]" : "text-muted")}
            >
              <List size={15} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={ctl.grid}
              onClick={() => ctl.setGrid(true)}
              className={cn(toggle, ctl.grid ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,24,28,0.08)]" : "text-muted")}
            >
              <Grid2X2 size={15} aria-hidden />
            </button>
          </div>
          <Button onClick={ctl.startUpload} disabled={ctl.busy}>
            <Upload size={15} aria-hidden />
            {ctl.busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
      <FileTable ctl={ctl} state={state} files={files} folders={ctl.tab === "all" ? folders : []} />
    </div>
  );
}
