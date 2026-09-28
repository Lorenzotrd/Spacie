"use client";
import { useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { CommentList } from "@/features/rail/comment-list";
import { VersionList } from "@/features/rail/version-list";
import { principalById, relativeTime } from "@/features/workspace/derive";
import type { Controller } from "@/features/workspace/use-controller";
import { useProjectFeed } from "@/features/workspace/use-project-feed";

type Feed = "all" | "comments" | "versions";
const FEEDS: { id: Feed; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "comments", label: "Comments" },
  { id: "versions", label: "Versions" },
];

function Timeline({ ctl }: { ctl: Controller }) {
  const state = ctl.state!;
  const events = state.activity.filter((a) => a.projectId === ctl.project);
  if (!events.length)
    return <EmptyState icon={<ActivityIcon size={18} />} title="No activity yet" hint="Changes by people and agents show up here." />;
  return (
    <ul className="m-0 list-none p-0">
      {events.map((a) => {
        const who = principalById(state, a.actorId);
        const file = a.fileId ? state.files.find((f) => f.id === a.fileId && !f.deleted) : undefined;
        return (
          <li key={a.id} className="flex min-h-[3.75rem] items-center group-data-[density=compact]/app:min-h-12 gap-3.5 border-b border-[#f3f1ed] last:border-b-0">
            <Avatar person={who} size="lg" />
            <p className="min-w-0 flex-1 text-sm text-[#55575f]">
              <span className="font-semibold text-ink">{who?.name ?? "Someone"}</span> {a.action}{" "}
              {file ? (
                <button type="button" onClick={() => ctl.openFile(file)} className="font-medium text-ink hover:text-accent">
                  {a.name}
                </button>
              ) : (
                <span className="font-medium text-ink">{a.name}</span>
              )}
            </p>
            <span className="shrink-0 text-[0.8125rem] text-muted">{relativeTime(a.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** What happened in the project: every action, or just its comments or versions. */
export function ActivityTab({ ctl, onCompare }: { ctl: Controller; onCompare: (fileId: string, n: number) => void }) {
  const state = ctl.state!;
  const [feed, setFeed] = useState<Feed>("all");
  const comments = useProjectFeed(ctl.project, "comments", state.revision, feed === "comments");
  const versions = useProjectFeed(ctl.project, "versions", state.revision, feed === "versions");
  const openById = (id: string) => {
    const f = state.files.find((x) => x.id === id);
    if (f) ctl.openFile(f);
  };

  const body = () => {
    if (feed === "all") return <Timeline ctl={ctl} />;
    const { feed: current, retry } = feed === "comments" ? comments : versions;
    if (current.status === "loading") return <SkeletonRows rows={3} height="h-14" />;
    if (current.status === "error") return <ErrorState message={current.message} onRetry={retry} />;
    return feed === "comments" ? (
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
    <>
      <Tabs label="Show" items={FEEDS} value={feed} onChange={setFeed} className="self-start" />
      <Card className={feed === "all" ? "px-5 py-2" : "p-5"}>{body()}</Card>
    </>
  );
}
