"use client";
import { ChevronRight, FolderOpen } from "lucide-react";
import type { FileMeta, Folder, PublicState } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { formatBytes, principalById, relativeTime, typeLabel, versionLabel } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";
import { fileActions } from "./file-actions";

const columns = "grid grid-cols-[2.6fr_0.8fr_0.9fr_1fr_1.3fr_44px] items-center px-4";
/** Makes the whole row the click target while the menu stays clickable above it. */
const stretched = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-accent";

function FolderRow({ folder, onOpen }: { folder: Folder; onOpen: () => void }) {
  return (
    <div className={cn(columns, "relative h-[3.625rem] border-b border-[#f3f1ed] text-[0.8125rem] hover:bg-subtle")}>
      <div className="flex min-w-0 items-center gap-3">
        <FileIcon folder />
        <button type="button" onClick={onOpen} className={cn("truncate text-left font-medium text-ink", stretched)}>
          {folder.name}
        </button>
      </div>
      <div><Badge tone="type">FOLDER</Badge></div>
      <span className="text-muted">—</span>
      <span className="text-muted">—</span>
      <span className="text-muted">—</span>
      <ChevronRight size={16} className="justify-self-center text-muted" aria-hidden />
    </div>
  );
}

function FileRow({ ctl, state, file }: { ctl: Controller; state: PublicState; file: FileMeta }) {
  const by = principalById(state, file.updatedBy);
  return (
    <div className={cn(columns, "relative h-[3.625rem] border-b border-[#f3f1ed] text-[0.8125rem] hover:bg-subtle")}>
      <div className="flex min-w-0 items-center gap-3">
        <FileIcon file={file} />
        <button
          type="button"
          onClick={() => ctl.openFile(file)}
          className={cn("truncate text-left font-medium text-ink", stretched)}
        >
          {file.name}
        </button>
      </div>
      <div><Badge tone="type">{typeLabel(file)}</Badge></div>
      <div>
        {file.version > 1 ? (
          <Badge tone="accent">{versionLabel(file.version)}</Badge>
        ) : (
          <span className="text-muted">{versionLabel(file.version)}</span>
        )}
      </div>
      <span className="text-ink-2">{relativeTime(file.updatedAt)}</span>
      <div className="flex min-w-0 items-center gap-2">
        {by && <Avatar person={by} size="sm" />}
        <span className="truncate text-ink">{by?.name ?? "—"}</span>
      </div>
      <div className="relative z-10 justify-self-center">
        <FileMenu label={`Actions for ${file.name}`} items={fileActions(ctl, file)} />
      </div>
    </div>
  );
}

function FileTile({ ctl, file }: { ctl: Controller; file: FileMeta }) {
  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-line-soft bg-card p-3.5 hover:border-line">
      <div className="flex items-start justify-between">
        <FileIcon file={file} size="md" />
        <div className="relative z-10">
          <FileMenu label={`Actions for ${file.name}`} items={fileActions(ctl, file)} />
        </div>
      </div>
      <button type="button" onClick={() => ctl.openFile(file)} className={cn("truncate text-left text-[0.8125rem] font-medium", stretched)}>
        {file.name}
      </button>
      <div className="flex items-center gap-2">
        <Badge tone="type">{typeLabel(file)}</Badge>
        {file.version > 1 && <Badge tone="accent">{versionLabel(file.version)}</Badge>}
      </div>
    </div>
  );
}

export function FileTable({
  ctl,
  state,
  files,
  folders,
}: {
  ctl: Controller;
  state: PublicState;
  files: FileMeta[];
  folders: Folder[];
}) {
  const bytes = files.reduce((n, f) => n + (f.storageKey ? f.size : 0), 0);
  const count = files.length + folders.length;
  const empty = !count && (
    <EmptyState
      icon={<FolderOpen size={20} />}
      title={ctl.tab === "all" ? "Nothing here yet" : ctl.tab === "docs" ? "No documents here" : "No assets here"}
      hint="Create a document, upload a file, or let an agent add one."
      action={
        <div className="flex gap-2">
          <Button onClick={() => ctl.dialog("document")}>New document</Button>
          <Button variant="primary" onClick={ctl.startUpload}>Upload</Button>
        </div>
      }
    />
  );
  return (
    <div className="overflow-hidden rounded-card border border-line-soft bg-card">
      {ctl.grid ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-3">
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => ctl.navigate(f.projectId, f.id)}
              className="flex items-center gap-3 rounded-xl border border-line-soft p-3.5 text-left text-[0.8125rem] font-medium hover:border-line"
            >
              <FileIcon folder size="md" />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
          {files.map((f) => (
            <FileTile key={f.id} ctl={ctl} file={f} />
          ))}
        </div>
      ) : (
        <div>
          <div aria-hidden className={cn(columns, "h-10 border-b border-[#efede8] bg-subtle text-xs font-medium text-muted")}>
            <span>Name</span>
            <span>Type</span>
            <span>Versions</span>
            <span>Modified</span>
            <span>By</span>
            <span />
          </div>
          {folders.map((f) => (
            <FolderRow key={f.id} folder={f} onOpen={() => ctl.navigate(f.projectId, f.id)} />
          ))}
          {files.map((f) => (
            <FileRow key={f.id} ctl={ctl} state={state} file={f} />
          ))}
        </div>
      )}
      {empty}
      <div className="flex h-11 items-center px-4 text-xs text-muted">
        <span className="flex-1">
          {count} {count === 1 ? "item" : "items"}
          {bytes ? ` · ${formatBytes(bytes)}` : ""}
        </span>
        <span>Drop a file anywhere here to add it</span>
      </div>
    </div>
  );
}
