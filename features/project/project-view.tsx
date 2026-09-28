"use client";
import { useState, type DragEvent } from "react";
import type { Principal } from "@/lib/types";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/components/ui/cn";
import { projectMembers } from "@/features/workspace/derive";
import type { Controller, ProjectTab } from "@/features/workspace/use-controller";
import { ActivityTab } from "./activity-tab";
import { FilesTab } from "./files-tab";
import { MembersTab } from "./members-tab";
import { SettingsTab } from "./settings-tab";

/** A project (tabs: files, activity, members, settings) or one of its folders (files only). */
export function ProjectView({
  ctl,
  onCompare,
  onPerson,
}: {
  ctl: Controller;
  onCompare: (fileId: string, version?: number) => void;
  onPerson: (p: Principal) => void;
}) {
  const state = ctl.state!;
  const [dragging, setDragging] = useState(false);
  const atRoot = !ctl.folder;
  const tab: ProjectTab = atRoot ? ctl.projectTab : "files";
  const fileCount = state.files.filter((f) => f.projectId === ctl.project && !f.deleted).length;
  const tabs: { id: ProjectTab; label: string; count?: number }[] = [
    { id: "files", label: "Files", count: fileCount },
    { id: "activity", label: "Activity" },
    { id: "members", label: "Members", count: projectMembers(state, ctl.project).length },
    { id: "settings", label: "Settings" },
  ];
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void ctl.uploadFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-7 pb-6 *:shrink-0", dragging && "bg-accent-tint/60")}
      onDragOver={(e) => {
        if (tab !== "files" || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[1.875rem] font-semibold tracking-[-0.025em]">
          {ctl.currentFolder?.name ?? ctl.currentProject?.name}
        </h1>
        {atRoot && ctl.currentProject?.description && (
          <p className="text-sm text-muted">{ctl.currentProject.description}</p>
        )}
      </div>
      {atRoot && (
        <Tabs label="Project" variant="underline" items={tabs} value={tab} onChange={ctl.setProjectTab} className="mt-0.5" />
      )}
      {tab === "files" && <FilesTab ctl={ctl} />}
      {tab === "activity" && <ActivityTab ctl={ctl} onCompare={onCompare} />}
      {tab === "members" && <MembersTab state={state} projectId={ctl.project} onPerson={onPerson} />}
      {tab === "settings" && <SettingsTab ctl={ctl} />}
    </div>
  );
}
