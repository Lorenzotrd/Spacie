"use client";
import { X } from "lucide-react";
import type { PublicState } from "@/lib/types";
import { AgentMark } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { latestAgentAction, relativeTime } from "@/features/workspace/derive";
import { useSeen } from "@/features/workspace/use-seen";

/**
 * The latest thing an agent did in this project, with a shortcut to review it.
 * Hidden once opened or dismissed, until an agent does something newer.
 */
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
  const { seen, markSeen } = useSeen(`banner:${state.workspace.id}:${projectId}`);
  const latest = latestAgentAction(state, projectId);
  if (!latest || latest.event.id === seen) return null;
  const { event, agent, file } = latest;
  const live = file && !file.deleted;
  const act = (run: () => void) => () => {
    markSeen(event.id);
    run();
  };
  return (
    <section
      aria-label="Latest AI activity"
      className="flex items-center gap-3 rounded-xl border border-accent-border bg-accent-tint py-2.5 pr-2 pl-3"
    >
      <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <AgentMark size={14} />
      </span>
      <p className="min-w-0 flex-1 text-[0.8125rem] text-ink-2">
        <span className="font-semibold text-ink">{agent.name}</span> {event.action}{" "}
        <span className="font-semibold text-ink">{event.name}</span> · {relativeTime(event.createdAt)}
      </p>
      {live && file.version > 1 ? (
        <Button onClick={act(() => onCompare(file.id))} className="border-accent-border text-accent-hover">
          Compare versions
        </Button>
      ) : live ? (
        <Button onClick={act(() => onOpen(file.id))} className="border-accent-border text-accent-hover">
          Open file
        </Button>
      ) : null}
      <IconButton label="Dismiss" onClick={() => markSeen(event.id)} className="hover:bg-accent-soft">
        <X size={15} />
      </IconButton>
    </section>
  );
}
