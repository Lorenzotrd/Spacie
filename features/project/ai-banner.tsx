"use client";
import type { PublicState } from "@/lib/types";
import { AgentMark } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { latestAgentAction, relativeTime } from "@/features/workspace/derive";

/** The latest thing an agent did in this project, with a shortcut to review it. */
export function AiBanner({
  state,
  projectId,
  onCompare,
  onOpen,
}: {
  state: PublicState;
  projectId: string;
  onCompare: (fileId: string) => void;
  onOpen: (fileId: string) => void;
}) {
  const latest = latestAgentAction(state, projectId);
  if (!latest) return null;
  const { event, agent, file } = latest;
  const live = file && !file.deleted;
  return (
    <section
      aria-label="Latest AI activity"
      className="flex items-center gap-3 rounded-xl border border-accent-border bg-accent-tint py-2.5 pr-2.5 pl-3"
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <AgentMark size={14} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] text-ink-2">
        <span className="font-semibold text-ink">{agent.name}</span> {event.action}{" "}
        <span className="font-semibold text-ink">{event.name}</span> · {relativeTime(event.createdAt)}
      </p>
      {live && file.version > 1 ? (
        <Button onClick={() => onCompare(file.id)} className="border-accent-border text-accent-hover">
          Compare versions
        </Button>
      ) : live ? (
        <Button onClick={() => onOpen(file.id)} className="border-accent-border text-accent-hover">
          Open file
        </Button>
      ) : null}
    </section>
  );
}
