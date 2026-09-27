"use client";
import { ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { AgentMark, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { folderFiles, isAgent, principalById, projectMembers, relativeTime, type FileTab } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";

const TABS: { id: FileTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "docs", label: "Docs" },
  { id: "assets", label: "Files" },
];
const row = "flex min-h-[68px] w-full items-center gap-3 border-b border-[#f3f1ed] px-3.5 text-left last:border-b-0";

export function MobileProject({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  const project = ctl.currentProject;
  if (!project)
    return (
      <div className="px-5 pt-7 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
        <EmptyState icon={<FolderOpen size={20} />} title="No projects yet" hint="Ask an owner to create one." />
      </div>
    );
  const place = { projectId: project.id, folderId: ctl.folder };
  const files = folderFiles(state.files, place, ctl.tab, ctl.sort);
  const folders = ctl.tab === "all" ? state.folders.filter((f) => f.projectId === project.id && f.parentId === ctl.folder) : [];
  const members = projectMembers(state, project.id);
  const total = state.files.filter((f) => f.projectId === project.id && !f.deleted).length;
  const back = () => {
    if (!ctl.currentFolder) return ctl.setView("home");
    ctl.navigate(project.id, ctl.currentFolder.parentId);
  };
  const whoLabel = (id: string) => (id === state.currentPrincipalId ? "You" : principalById(state, id)?.name ?? "Someone");

  return (
    <div className="flex flex-col gap-[18px] px-5 pt-5 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-2">
        <button type="button" onClick={back} aria-label="Back" className="-ml-2.5 flex size-11 items-center justify-center">
          <ChevronLeft size={22} aria-hidden />
        </button>
        <div className="flex-1" />
        <AvatarStack people={members} max={3} />
        <Button size="lg" className="h-11 rounded-xl" onClick={() => ctl.dialog("share")}>
          Share
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{ctl.currentFolder?.name ?? project.name}</h1>
        <span className="text-sm text-muted">
          {total} files · {members.length} members
        </span>
      </div>
      <Tabs label="Filter files" items={TABS} value={ctl.tab} onChange={ctl.setTab} stretch size="touch" />
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#eceae4] bg-card">
        {folders.map((f) => (
          <button key={f.id} type="button" onClick={() => ctl.navigate(project.id, f.id)} className={row}>
            <FileIcon folder size="lg" className="bg-[#f1f0ec]" />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[15px] font-medium">{f.name}</span>
              <span className="text-[13px] text-muted">Folder</span>
            </span>
            <ChevronRight size={18} className="text-[#a3a5ac]" aria-hidden />
          </button>
        ))}
        {files.map((f) => (
          <button key={f.id} type="button" onClick={() => ctl.openFile(f)} className={row}>
            <FileIcon file={f} size="lg" className="bg-[#f1f0ec]" />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[15px] font-medium">{f.name}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                {isAgent(state, f.updatedBy) && (
                  <span aria-hidden className="flex size-4 items-center justify-center rounded-[5px] bg-accent-soft text-accent">
                    <AgentMark size={8} />
                  </span>
                )}
                {whoLabel(f.updatedBy)} · {relativeTime(f.updatedAt)}
              </span>
            </span>
            {f.version > 1 && <Badge tone="accent" className="font-semibold">v{f.version}</Badge>}
            <ChevronRight size={18} className="text-[#a3a5ac]" aria-hidden />
          </button>
        ))}
        {!files.length && !folders.length && (
          <EmptyState icon={<FolderOpen size={20} />} title="Nothing here yet" hint="Tap + to add a photo, a PDF or a document." />
        )}
      </div>
      {!!(files.length || folders.length) && (
        <p className="text-center text-[13px] text-muted">Tap + to add a photo, a PDF or a document</p>
      )}
    </div>
  );
}
