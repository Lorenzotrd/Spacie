"use client";
import { ArrowLeft, Download, Link2 } from "lucide-react";
import type { FileMeta } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/ui/states";
import { principalById, relativeTime, typeLabel, versionLabel } from "@/features/workspace/derive";
import { FileIcon } from "@/features/workspace/file-icon";
import type { Controller } from "@/features/workspace/use-controller";
import { FileBody } from "./file-body";
import { downloadFile, useAssetUrls } from "./use-asset-urls";

/** Desktop view of one open file. */
export function FileView({ ctl, file, onCompare }: { ctl: Controller; file: FileMeta; onCompare: () => void }) {
  const state = ctl.state!;
  const { url, previewUrl } = useAssetUrls(file);
  const by = principalById(state, file.updatedBy);
  const here = ctl.presence.filter((e) => e.resourceId === file.id && e.principalId !== state.currentPrincipalId);
  const download = () => downloadFile(file, ctl.detail?.file.content).catch((e: Error) => ctl.setError(e.message));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-7 pt-6 pb-6">
      <button type="button" onClick={ctl.closeFile} className="inline-flex h-8 items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden />
        Back to {ctl.currentFolder?.name ?? ctl.currentProject?.name ?? "project"}
      </button>
      <div className="flex items-start gap-3">
        <FileIcon file={file} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h1 className="m-0 truncate text-2xl font-semibold tracking-[-0.02em]">{file.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone="type">{typeLabel(file)}</Badge>
            {file.version > 1 ? <Badge tone="accent">{versionLabel(file.version)}</Badge> : <span>{versionLabel(1)}</span>}
            <span className="inline-flex items-center gap-1.5">
              {by && <Avatar person={by} size="xs" />}
              Edited by {by?.name ?? "someone"} · {relativeTime(file.updatedAt)}
            </span>
          </div>
          {!!here.length && (
            <p className="text-xs text-muted">
              {here.map((e) => `${principalById(state, e.principalId)?.name ?? "Someone"} is ${e.state}`).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {file.version > 1 && <Button onClick={onCompare}>Compare versions</Button>}
          <Button onClick={() => ctl.shareOne(file)}>
            <Link2 size={15} aria-hidden />
            Share
          </Button>
          <IconButton label={`Download ${file.name}`} onClick={download}>
            <Download size={17} />
          </IconButton>
          <FileMenu
            label={`Actions for ${file.name}`}
            items={[
              { label: "Copy link", onSelect: () => void ctl.copyLink(file) },
              { label: "Rename", onSelect: () => ctl.dialog("rename", file.name) },
              { label: "Move to folder", onSelect: () => ctl.dialog("move") },
              { label: "Move to trash", danger: true, onSelect: () => ctl.dialog("delete") },
            ]}
          />
        </div>
      </div>
      {ctl.detailError && !ctl.detail ? (
        <ErrorState message={ctl.detailError} onRetry={ctl.retryDetail} />
      ) : (
      <FileBody
        file={file}
        detail={ctl.detail}
        url={url}
        previewUrl={previewUrl}
        onDownload={download}
        onSave={async (content) => {
          await ctl.mutate({ action: "update_document", id: file.id, content, baseVersion: file.version });
        }}
      />
      )}
    </div>
  );
}
