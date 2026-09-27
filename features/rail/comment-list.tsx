"use client";
import { MessageSquare, ThumbsUp } from "lucide-react";
import type { Comment, PublicState } from "@/lib/types";
import type { Command } from "@/lib/service";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { principalById, relativeTime } from "@/features/workspace/derive";
import { TimelineItem } from "./timeline";

type Item = Comment & { fileName?: string };

/**
 * Comments, newest last within a file (threads) or newest first across a project.
 * Project-wide lists show which file each comment is on.
 */
export function CommentList({
  state,
  comments,
  mutate,
  onReply,
  onOpenFile,
}: {
  state: PublicState;
  comments: Item[];
  mutate: (c: Command) => Promise<unknown>;
  onReply?: (comment: Comment) => void;
  onOpenFile?: (fileId: string) => void;
}) {
  if (!comments.length)
    return <EmptyState icon={<MessageSquare size={18} />} title="No comments yet" hint="Start the conversation on a file." />;
  const act = (command: Command) => void mutate(command).catch(() => undefined);
  const link = "text-xs font-medium text-muted hover:text-ink min-h-6";
  return (
    <ol className="flex flex-col">
      {comments.map((c) => {
        const who = principalById(state, c.actorId);
        return (
          <TimelineItem
            key={c.id}
            who={who}
            when={relativeTime(c.createdAt)}
            footer={
              <div className="flex items-center gap-3 pt-1">
                {onReply && !c.parentId && (
                  <button type="button" className={link} onClick={() => onReply(c)}>
                    Reply
                  </button>
                )}
                <button
                  type="button"
                  className={cn(link, "inline-flex items-center gap-1")}
                  aria-label={`Like (${c.reactions.length})`}
                  aria-pressed={c.reactions.includes(state.currentPrincipalId)}
                  onClick={() => act({ action: "react_comment", id: c.id })}
                >
                  <ThumbsUp size={12} aria-hidden />
                  {c.reactions.length || ""}
                </button>
                <button type="button" className={link} onClick={() => act({ action: "resolve_comment", id: c.id })}>
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
              </div>
            }
          >
            <div className={cn("flex flex-col gap-1", c.parentId && "border-l-2 border-line-soft pl-2.5", c.resolved && "opacity-60")}>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{who?.name ?? "Someone"}</span>
                {c.fileName && (
                  <>
                    <span>on</span>
                    <button
                      type="button"
                      onClick={() => onOpenFile?.(c.fileId)}
                      className="max-w-full truncate font-medium text-ink underline-offset-2 hover:underline"
                    >
                      {c.fileName}
                    </button>
                  </>
                )}
                {c.resolved && <Badge tone="success">Resolved</Badge>}
              </span>
              <p className="break-words whitespace-pre-wrap text-ink-2">{c.content}</p>
            </div>
          </TimelineItem>
        );
      })}
    </ol>
  );
}
