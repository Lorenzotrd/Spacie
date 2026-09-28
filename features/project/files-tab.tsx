"use client";
import { ArrowDownUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { folderFiles, projectFiles } from "@/features/workspace/derive";
import type { Controller } from "@/features/workspace/use-controller";
import { FileTable } from "./file-table";
import { FolderCards } from "./folder-cards";

/** Folders as cards, then the files: every file of the project at its root, or the open folder's. */
export function FilesTab({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  const atRoot = !ctl.folder;
  const folders = state.folders
    .filter((f) => f.projectId === ctl.project && f.parentId === ctl.folder)
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = atRoot
    ? projectFiles(state.files, ctl.project, ctl.sort)
    : folderFiles(state.files, { projectId: ctl.project, folderId: ctl.folder }, "all", ctl.sort);
  return (
    <>
      <FolderCards
        folders={folders}
        files={state.files}
        onOpen={(f) => ctl.navigate(f.projectId, f.id)}
        onNew={() => ctl.dialog("folder")}
      />
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-sm font-semibold">{atRoot ? "All files" : "Files"}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => ctl.setSort(ctl.sort === "recent" ? "name" : "recent")}
            aria-label={`Sorted ${ctl.sort === "recent" ? "most recent first" : "by name"}. Click to change.`}
            className="font-normal text-ink-2"
          >
            <ArrowDownUp size={15} aria-hidden />
            {ctl.sort === "recent" ? "Recent first" : "Name A–Z"}
          </Button>
          <Button onClick={ctl.startUpload} disabled={ctl.busy}>
            <Upload size={15} aria-hidden />
            {ctl.busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>
      <FileTable ctl={ctl} state={state} files={files} folderCount={folders.length} showFolder={atRoot} />
    </>
  );
}
