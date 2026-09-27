"use client";
import { Clock, FileText, Layers, type LucideIcon } from "lucide-react";
import type { PublicState } from "@/lib/types";
import { AgentMark } from "@/components/ui/avatar";
import { projectStats, shortAge } from "@/features/workspace/derive";

type Stat = { key: string; icon: LucideIcon | "agent"; value: string; label: string; hint?: string; onDetails: () => void };

export function StatCards({
  state,
  projectId,
  onFiles,
  onVersions,
  onActivity,
}: {
  state: PublicState;
  projectId: string;
  onFiles: () => void;
  onVersions: () => void;
  onActivity: () => void;
}) {
  const s = projectStats(state, projectId);
  const stats: Stat[] = [
    { key: "files", icon: FileText, value: String(s.files), label: "Files in this project", onDetails: onFiles },
    { key: "versions", icon: Layers, value: String(s.versions), label: "Saved versions", onDetails: onVersions },
    {
      key: "ai",
      icon: "agent",
      value: String(s.aiChanges),
      label: "Changes by AI",
      hint: "Among the latest 100 workspace actions",
      onDetails: onActivity,
    },
    { key: "last", icon: Clock, value: shortAge(s.lastModified), label: "Since last change", onDetails: onActivity },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((st) => {
        const Icon = st.icon;
        return (
          <div key={st.key} className="flex flex-col gap-3.5 rounded-card border border-line-soft bg-card p-4">
            <div className="flex items-center">
              <span className="flex size-[2.125rem] items-center justify-center rounded-[0.5625rem] bg-accent-tint text-accent">
                {Icon === "agent" ? <AgentMark size={15} /> : <Icon size={17} strokeWidth={1.8} aria-hidden />}
              </span>
              <button
                type="button"
                onClick={st.onDetails}
                aria-label={`Details: ${st.label}`}
                className="ml-auto rounded px-1 text-xs text-muted hover:text-ink"
              >
                Details ›
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[1.625rem] font-semibold tracking-[-0.02em]">{st.value}</span>
              <span className="text-[0.8125rem] text-muted">{st.label}</span>
              {st.hint && <span className="text-[0.6875rem] text-muted">{st.hint}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
