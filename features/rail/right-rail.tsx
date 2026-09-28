"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { Comment, FileMeta } from "@/lib/types";
import { IconButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import type { Controller, RailTab } from "@/features/workspace/use-controller";
import { principalById } from "@/features/workspace/derive";
import { ActivityList } from "./activity-list";
import { CommentComposer } from "./comment-composer";
import { CommentList } from "./comment-list";
import { VersionList } from "./version-list";

const TABS: { id: RailTab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "comments", label: "Comments" },
  { id: "versions", label: "Versions" },
];

/** Right panel on an open file: its activity, comments and versions. */
export function RightRail({
  ctl,
  file,
  onCompare,
}: {
  ctl: Controller;
  file: FileMeta;
  onCompare: (fileId: string, n: number) => void;
}) {
  const state = ctl.state!;
  const { detail, rail } = ctl;
  const [reply, setReply] = useState<Comment | null>(null);
  const send = async (text: string) => {
    await ctl.mutate({ action: "create_comment", id: file.id, content: text, parentId: reply?.id ?? null });
    setReply(null);
  };

  const body = () => {
    if (rail === "activity") return <ActivityList state={state} projectId={ctl.project} fileId={file.id} />;
    if (!detail)
      return ctl.detailError ? (
        <ErrorState message={ctl.detailError} onRetry={ctl.retryDetail} />
      ) : (
        <SkeletonRows rows={3} height="h-14" />
      );
    return rail === "comments" ? (
      <CommentList state={state} comments={detail.comments} mutate={ctl.mutate} onReply={setReply} />
    ) : (
      <VersionList
        state={state}
        versions={detail.versions}
        file={file}
        mutate={ctl.mutate}
        onCompare={onCompare}
        onError={ctl.setError}
      />
    );
  };

  return (
    <aside aria-label="In this file" className="flex w-80 shrink-0 flex-col gap-[1.125rem] border-l border-[#eeece7] px-5 py-6">
      <div className="flex items-center">
        <h2 className="flex-1 text-[0.9375rem] font-semibold">In this file</h2>
        <IconButton label="Close panel" onClick={() => ctl.setShowRail(false)}>
          <X size={16} />
        </IconButton>
      </div>
      <Tabs label="Panel" items={TABS} value={rail} onChange={ctl.setRail} stretch />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{body()}</div>
      {rail === "comments" && (
        <CommentComposer
          onSend={send}
          replyingTo={reply ? principalById(state, reply.actorId)?.name ?? "comment" : null}
          onCancelReply={() => setReply(null)}
        />
      )}
    </aside>
  );
}
