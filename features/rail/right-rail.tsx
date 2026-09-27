"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { Comment } from "@/lib/types";
import { IconButton } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import type { Controller, RailTab } from "@/features/workspace/use-controller";
import { useProjectFeed } from "@/features/workspace/use-project-feed";
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

/** Right panel: activity, comments and versions of the open file, or of the project. */
export function RightRail({ ctl, onCompare }: { ctl: Controller; onCompare: (fileId: string, n: number) => void }) {
  const state = ctl.state!;
  const { file, detail, rail } = ctl;
  const [reply, setReply] = useState<Comment | null>(null);
  const projectMode = !file;
  const comments = useProjectFeed(ctl.project, "comments", state.revision, projectMode && rail === "comments");
  const versions = useProjectFeed(ctl.project, "versions", state.revision, projectMode && rail === "versions");
  const openById = (id: string) => {
    const f = state.files.find((x) => x.id === id);
    if (f) ctl.openFile(f);
  };
  const send = async (text: string) => {
    if (!file) return;
    await ctl.mutate({ action: "create_comment", id: file.id, content: text, parentId: reply?.id ?? null });
    setReply(null);
  };

  const body = () => {
    if (rail === "activity") return <ActivityList state={state} projectId={ctl.project} fileId={file?.id} />;
    if (file) {
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
    }
    const { feed, retry } = rail === "comments" ? comments : versions;
    if (feed.status === "loading") return <SkeletonRows rows={3} height="h-14" />;
    if (feed.status === "error") return <ErrorState message={feed.message} onRetry={retry} />;
    return rail === "comments" ? (
      <CommentList state={state} comments={comments.feed.status === "ready" ? comments.feed.items : []} mutate={ctl.mutate} onOpenFile={openById} />
    ) : (
      <VersionList
        state={state}
        versions={versions.feed.status === "ready" ? versions.feed.items : []}
        mutate={ctl.mutate}
        onCompare={onCompare}
        onError={ctl.setError}
      />
    );
  };

  return (
    <aside aria-label={file ? "In this file" : "In this project"} className="flex w-80 shrink-0 flex-col gap-[1.125rem] border-l border-[#eeece7] px-5 py-6">
      <div className="flex items-center">
        <h2 className="flex-1 text-[0.9375rem] font-semibold">{file ? "In this file" : "In this project"}</h2>
        <IconButton label="Close panel" onClick={() => ctl.setShowRail(false)}>
          <X size={16} />
        </IconButton>
      </div>
      <Tabs label="Panel" items={TABS} value={rail} onChange={ctl.setRail} stretch />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{body()}</div>
      {file && rail === "comments" && (
        <CommentComposer
          onSend={send}
          replyingTo={reply ? principalById(state, reply.actorId)?.name ?? "comment" : null}
          onCancelReply={() => setReply(null)}
        />
      )}
    </aside>
  );
}
