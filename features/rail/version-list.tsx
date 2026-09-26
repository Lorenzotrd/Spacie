"use client";
import { Layers } from "lucide-react";
import type { FileMeta, PublicState, VersionMeta } from "@/lib/types";
import type { Command } from "@/lib/service";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatBytes, principalById, relativeTime } from "@/features/workspace/derive";
import { TimelineItem } from "./timeline";

type Item = VersionMeta & { fileName?: string };

/** Opens one stored version of an uploaded file as a download. */
export async function downloadVersion(fileId: string, number: number) {
  const r = await fetch(`/api/assets?id=${fileId}&version=${number}&download=1`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) throw new Error(data.error ?? "Download failed");
  window.location.assign(data.url);
}

/**
 * Versions of one file (with restore) or of a whole project (with file names).
 * Every version can be compared with the current one.
 */
export function VersionList({
  state,
  versions,
  file,
  mutate,
  onCompare,
  onError,
}: {
  state: PublicState;
  versions: Item[];
  /** Set when listing a single file's versions. */
  file?: FileMeta;
  mutate: (c: Command) => Promise<unknown>;
  onCompare: (fileId: string, number: number) => void;
  onError: (message: string) => void;
}) {
  if (!versions.length)
    return <EmptyState icon={<Layers size={18} />} title="No versions yet" hint="Every change by a person or an agent saves one." />;
  const link = "min-h-6 text-xs font-medium text-accent-hover hover:underline";
  return (
    <ol className="flex flex-col">
      {versions.map((v) => {
        const who = principalById(state, v.actorId);
        const owner = file ?? state.files.find((f) => f.id === v.fileId);
        const current = owner?.version === v.number;
        return (
          <TimelineItem
            key={v.id}
            who={who}
            when={relativeTime(v.createdAt)}
            footer={
              <div className="flex items-center gap-3 pt-1">
                {owner && owner.version > 1 && (
                  <button type="button" className={link} onClick={() => onCompare(v.fileId, v.number)}>
                    Compare
                  </button>
                )}
                {owner?.storageKey && (
                  <button
                    type="button"
                    className={link}
                    onClick={() => downloadVersion(v.fileId, v.number).catch((e: Error) => onError(e.message))}
                  >
                    Download
                  </button>
                )}
                {file && !current && (
                  <button
                    type="button"
                    className={link}
                    onClick={() =>
                      void mutate({ action: "restore_version", id: file.id, version: v.number }).catch(() => undefined)
                    }
                  >
                    Restore
                  </button>
                )}
              </div>
            }
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-ink">Version {v.number}</span>
              {v.fileName && (
                <>
                  of <span className="font-medium text-ink">{v.fileName}</span>
                </>
              )}
              {current && <Badge tone="accent">Current</Badge>}
            </span>
            <span className="block">
              {who?.name ?? "Someone"} · {v.message}
              {v.size ? ` · ${formatBytes(v.size)}` : ""}
            </span>
          </TimelineItem>
        );
      })}
    </ol>
  );
}
