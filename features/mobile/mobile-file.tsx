"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, Download, Link2, RotateCcw } from "lucide-react";
import type { FileMeta } from "@/lib/types";
import { AgentMark, Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { SkeletonRows } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { FileBody } from "@/features/file/file-body";
import { downloadFile, useAssetUrls } from "@/features/file/use-asset-urls";
import { CommentComposer } from "@/features/rail/comment-composer";
import { CommentList } from "@/features/rail/comment-list";
import { isDocument, principalById, relativeTime, typeLabel } from "@/features/workspace/derive";
import type { Controller } from "@/features/workspace/use-controller";

const action = "flex h-16 flex-col items-center justify-center gap-[5px] rounded-[14px] border border-line bg-card text-[13px] font-medium text-ink disabled:opacity-50";

export function MobileFile({ ctl, file }: { ctl: Controller; file: FileMeta }) {
  const state = ctl.state!;
  const { url, previewUrl } = useAssetUrls(file);
  const [picked, setPicked] = useState(file.version);
  const [expanded, setExpanded] = useState(false);
  const doc = isDocument(file);
  useEffect(() => setPicked(file.version), [file.id, file.version]);
  const by = principalById(state, file.updatedBy);
  const versions = ctl.detail?.versions ?? [];
  const download = () => downloadFile(file, ctl.detail?.file.content).catch((e: Error) => ctl.setError(e.message));
  const restore = () =>
    void ctl
      .mutate({ action: "restore_version", id: file.id, version: picked })
      .then(() => ctl.setNotice(`Version ${picked} restored`))
      .catch(() => undefined);

  return (
    <>
      <div className="flex flex-col gap-[18px] px-5 pt-5 pb-[120px]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={ctl.closeFile} aria-label="Back" className="-ml-2.5 flex size-11 items-center justify-center">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <span className="flex-1 truncate text-sm text-muted">{ctl.currentProject?.name}</span>
          <FileMenu
            touch
            label={`More options for ${file.name}`}
            items={[
              ...(file.version > 1 ? [{ label: "Compare versions", onSelect: () => ctl.setCompare({ fileId: file.id, version: picked }) }] : []),
              { label: "Copy link", onSelect: () => void ctl.copyLink(file) },
              { label: "Rename", onSelect: () => ctl.dialog("rename", file.name) },
              { label: "Move to trash", danger: true, onSelect: () => ctl.dialog("delete") },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[21px] leading-[1.3] font-semibold tracking-[-0.015em] break-words">{file.name}</h1>
          <span className="flex items-center gap-1.5 text-[13px] text-muted">
            <Badge tone="type">{typeLabel(file)}</Badge>
            Edited by {by?.name ?? "someone"} {relativeTime(file.updatedAt)}
          </span>
        </div>
        <div
          className={cn(
            "relative overflow-hidden",
            doc && !expanded && "max-h-[196px] rounded-2xl border border-[#eceae4] bg-card",
          )}
        >
          <FileBody compact file={file} detail={ctl.detail} url={url} previewUrl={previewUrl} onDownload={download}
            onSave={async (content) => {
              await ctl.mutate({ action: "update_document", id: file.id, content, baseVersion: file.version });
            }}
          />
          {doc && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-3 text-sm font-medium text-accent"
            >
              Read and edit the full document
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <button type="button" className={action} onClick={() => ctl.shareOne(file)}>
            <Link2 size={19} className="text-accent" aria-hidden />
            Share link
          </button>
          <button type="button" className={action} onClick={download}>
            <Download size={19} className="text-accent" aria-hidden />
            Download
          </button>
          <button type="button" className={action} onClick={restore} disabled={picked === file.version}>
            <RotateCcw size={19} className="text-accent" aria-hidden />
            Restore
          </button>
        </div>
        <section className="flex flex-col gap-2.5">
          <h2 className="m-0 text-[17px] font-semibold">Versions</h2>
          {!ctl.detail && <SkeletonRows rows={2} height="h-[68px]" />}
          <div role="radiogroup" aria-label="Pick a version to restore" className="flex flex-col gap-2.5">
            {versions.map((v) => {
              const who = principalById(state, v.actorId);
              const active = v.number === picked;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPicked(v.number)}
                  className={cn(
                    "flex min-h-[68px] items-center gap-3 rounded-[14px] bg-card px-3.5 text-left",
                    active ? "border-[1.5px] border-accent" : "border border-[#eceae4]",
                  )}
                >
                  {who?.type === "agent" ? (
                    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
                      <AgentMark size={15} />
                    </span>
                  ) : (
                    <Avatar person={who} size="lg" className="size-9" />
                  )}
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">Version {v.number}</span>
                    <span className="text-[13px] text-muted">
                      {who?.name ?? "Someone"} · {relativeTime(v.createdAt)}
                    </span>
                  </span>
                  {v.number === file.version && <Badge tone="accent" className="font-semibold">Current</Badge>}
                </button>
              );
            })}
          </div>
        </section>
        <section className="flex flex-col gap-2.5">
          <h2 className="m-0 text-[17px] font-semibold">Comments</h2>
          {ctl.detail && <CommentList state={state} comments={ctl.detail.comments} mutate={ctl.mutate} />}
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eceae4] bg-card px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <CommentComposer
          large
          placeholder="Comment on this file"
          onSend={async (text) => {
            await ctl.mutate({ action: "create_comment", id: file.id, content: text });
          }}
        />
      </div>
    </>
  );
}
