"use client";
import { FolderOpen } from "lucide-react";
import type { FileMeta, PublicState } from "@/lib/types";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { fileHistory, formatBytes, isDocument, relativeTime, typeLabel, versionLabel } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";
import { fileActions } from "./file-actions";

const columns = "grid grid-cols-[2.4fr_1fr_2fr_0.9fr_44px] items-center gap-3 px-[1.125rem]";
/** Makes the whole row the click target while the menu stays clickable above it. */
const stretched = "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-accent";

/** "PPTX · Audit · 2.1 MB": type, then the folder when listing a whole project, then size for uploads. */
function metaLine(state: PublicState, file: FileMeta, showFolder: boolean): string {
  const folder = showFolder && file.folderId ? state.folders.find((f) => f.id === file.folderId)?.name : undefined;
  return [isDocument(file) ? "Doc" : typeLabel(file), folder, file.storageKey ? formatBytes(file.size) : undefined]
    .filter(Boolean)
    .join(" · ");
}

function FileRow({ ctl, state, file, showFolder }: { ctl: Controller; state: PublicState; file: FileMeta; showFolder: boolean }) {
  const { people, last } = fileHistory(state, file);
  return (
    <div className={cn(columns, "relative h-[3.75rem] border-b group-data-[density=compact]/app:h-12 border-[#f3f1ed] text-[0.8125rem] hover:bg-subtle")}>
      <div className="flex min-w-0 items-center gap-3">
        <FileIcon file={file} tinted />
        <div className="flex min-w-0 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => ctl.openFile(file)}
            className={cn("truncate text-left font-medium text-ink", stretched)}
          >
            {file.name}
          </button>
          <span className="truncate text-xs text-muted">{metaLine(state, file, showFolder)}</span>
        </div>
      </div>
      <AvatarStack people={people} max={3} />
      <p className="truncate text-ink-2">
        <span className="font-medium text-ink">{last.who?.name ?? "Someone"}</span> {last.what}{" "}
        <span className="text-muted">· {relativeTime(last.at)}</span>
      </p>
      <div>
        {file.version > 1 ? (
          <Badge tone="accent">{versionLabel(file.version)}</Badge>
        ) : (
          <span className="text-xs text-muted">{versionLabel(file.version)}</span>
        )}
      </div>
      <div className="relative z-10 justify-self-center">
        <FileMenu label={`Actions for ${file.name}`} items={fileActions(ctl, file)} />
      </div>
    </div>
  );
}

/** The file list of a project or folder, with who changed each file and how. */
export function FileTable({
  ctl,
  state,
  files,
  folderCount,
  showFolder,
}: {
  ctl: Controller;
  state: PublicState;
  files: FileMeta[];
  folderCount: number;
  /** Listing a whole project: name each file's folder. */
  showFolder: boolean;
}) {
  const bytes = files.reduce((n, f) => n + (f.storageKey ? f.size : 0), 0);
  const summary = [
    `${files.length} file${files.length === 1 ? "" : "s"}`,
    folderCount ? `${folderCount} folder${folderCount === 1 ? "" : "s"}` : "",
    bytes ? formatBytes(bytes) : "",
  ].filter(Boolean);
  return (
    <div className="overflow-hidden rounded-card border border-line-soft bg-card">
      <div aria-hidden className={cn(columns, "h-10 border-b border-[#efede8] bg-subtle text-xs font-medium text-muted")}>
        <span>Name</span>
        <span>Edited by</span>
        <span>Last change</span>
        <span>Versions</span>
        <span />
      </div>
      {files.map((f) => (
        <FileRow key={f.id} ctl={ctl} state={state} file={f} showFolder={showFolder} />
      ))}
      {!files.length && (
        <EmptyState
          icon={<FolderOpen size={20} />}
          title="No files here yet"
          hint="Create a document, upload a file, or let an agent add one."
          action={
            <div className="flex gap-2">
              <Button onClick={() => ctl.dialog("document")}>New document</Button>
              <Button variant="primary" onClick={ctl.startUpload}>Upload</Button>
            </div>
          }
        />
      )}
      <div className="flex h-11 items-center px-[1.125rem] text-xs text-muted">
        <span className="flex-1">{summary.join(" · ")}</span>
        <span>Drop a file here to add it</span>
      </div>
    </div>
  );
}
