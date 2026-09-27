import { Activity as ActivityIcon } from "lucide-react";
import type { PublicState } from "@/lib/types";
import { EmptyState } from "@/components/ui/states";
import { principalById, relativeTime } from "@/features/workspace/derive";
import { byDay, DayGroup, TimelineItem } from "./timeline";

/** Workspace activity, optionally narrowed to a project or a file. */
export function ActivityList({
  state,
  projectId,
  fileId,
  limit,
}: {
  state: PublicState;
  projectId?: string;
  fileId?: string;
  limit?: number;
}) {
  const events = state.activity
    .filter((a) => (fileId ? a.fileId === fileId : projectId ? a.projectId === projectId : true))
    .slice(0, limit);
  if (!events.length)
    return <EmptyState icon={<ActivityIcon size={18} />} title="No activity yet" hint="Changes by people and agents show up here." />;
  return (
    <div className="flex flex-col gap-4">
      {byDay(events, (a) => a.createdAt).map((g) => (
        <DayGroup key={g.label} label={g.label}>
          {g.items.map((a) => {
            const who = principalById(state, a.actorId);
            return (
              <TimelineItem key={a.id} who={who} when={relativeTime(a.createdAt)}>
                <span className="font-semibold text-ink">{who?.name ?? "Someone"}</span> {a.action}{" "}
                <span className="font-medium text-ink">{a.name}</span>
              </TimelineItem>
            );
          })}
        </DayGroup>
      ))}
    </div>
  );
}
