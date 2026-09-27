"use client";
import { useEffect, useMemo, useState } from "react";
import NextImage from "next/image";
import type { FileMeta, PublicState, VersionMeta } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { cn } from "@/components/ui/cn";
import { formatBytes, isDocument, principalById, relativeTime } from "@/features/workspace/derive";
import { useFileDetail } from "@/features/workspace/use-file-detail";
import { downloadVersion } from "@/features/rail/version-list";
import { diffLines, htmlToLines } from "./text-diff";

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

async function versionBody(fileId: string, n: number): Promise<string> {
  const r = await fetch(`/api/files?id=${fileId}&version=${n}`, { cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "Could not load this version.");
  return data.content as string;
}

async function versionUrl(fileId: string, n: number): Promise<string> {
  const r = await fetch(`/api/assets?id=${fileId}&version=${n}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) throw new Error(data.error ?? "Could not load this version.");
  return data.url as string;
}

/** Loads something for a pair of versions; returns the latest result. */
function usePair<T>(load: (n: number) => Promise<T>, a: number, b: number, key: string) {
  const [pair, setPair] = useState<Load<[T, T]>>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    setPair({ status: "loading" });
    Promise.all([load(a), load(b)])
      .then((value) => !cancelled && setPair({ status: "ready", value }))
      .catch((e: Error) => !cancelled && setPair({ status: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [a, b, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return pair;
}

function DocumentDiff({ file, before, after }: { file: FileMeta; before: number; after: number }) {
  const pair = usePair((n) => versionBody(file.id, n), before, after, file.id);
  const lines = useMemo(
    () => (pair.status === "ready" ? diffLines(htmlToLines(pair.value[0]), htmlToLines(pair.value[1])) : []),
    [pair],
  );
  if (pair.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (pair.status === "error") return <ErrorState message={pair.message} />;
  const added = lines.filter((l) => l.change === "added").length;
  const removed = lines.filter((l) => l.change === "removed").length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        {added || removed ? `${added} paragraph${added === 1 ? "" : "s"} added · ${removed} removed` : "No text changes between these versions."}
      </p>
      <ol className="max-h-[55vh] overflow-y-auto rounded-xl border border-line-soft bg-subtle p-3 text-[13px] leading-relaxed">
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              "rounded px-2 py-1",
              l.change === "added" && "bg-success-soft text-success",
              l.change === "removed" && "bg-[#fcf2f1] text-danger line-through",
            )}
          >
            <span className="sr-only">{l.change === "added" ? "Added: " : l.change === "removed" ? "Removed: " : ""}</span>
            {l.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function VersionCard({ state, file, version, url, onError }: {
  state: PublicState; file: FileMeta; version: VersionMeta | undefined; url?: string; onError: (m: string) => void;
}) {
  if (!version) return null;
  const who = principalById(state, version.actorId);
  const image = (version.mime ?? file.mime).startsWith("image/");
  return (
    <figure className="m-0 flex min-w-0 flex-1 flex-col gap-3 rounded-xl border border-line-soft p-3">
      {image && url ? (
        <NextImage src={url} alt={`${file.name}, version ${version.number}`} width={600} height={400} unoptimized className="h-64 w-full rounded-lg bg-subtle object-contain" />
      ) : image ? (
        <Skeleton className="h-64 w-full" />
      ) : null}
      <figcaption className="flex flex-col gap-1 text-[13px]">
        <span className="font-semibold">Version {version.number}{file.version === version.number ? " · current" : ""}</span>
        <span className="text-muted">
          {who?.name ?? "Someone"} · {relativeTime(version.createdAt)}
          {version.size ? ` · ${formatBytes(version.size)}` : ""}
        </span>
        <span className="text-muted">{version.message}</span>
      </figcaption>
      <Button size="sm" className="self-start" onClick={() => downloadVersion(file.id, version.number).catch((e: Error) => onError(e.message))}>
        Download
      </Button>
    </figure>
  );
}

function AssetCompare({ state, file, versions, before, after, onError }: {
  state: PublicState; file: FileMeta; versions: VersionMeta[]; before: number; after: number; onError: (m: string) => void;
}) {
  const image = file.mime.startsWith("image/");
  const urls = usePair((n) => (image ? versionUrl(file.id, n) : Promise.resolve("")), before, after, file.id);
  const pick = (n: number) => versions.find((v) => v.number === n);
  const [a, b] = urls.status === "ready" ? urls.value : [undefined, undefined];
  return (
    <div className="flex flex-col gap-3">
      {urls.status === "error" && <ErrorState message={urls.message} />}
      <div className="flex flex-col gap-3 md:flex-row">
        <VersionCard state={state} file={file} version={pick(before)} url={a} onError={onError} />
        <VersionCard state={state} file={file} version={pick(after)} url={b} onError={onError} />
      </div>
      {!image && <p className="text-xs text-muted">Visual comparison is available for documents and images. Download both versions to compare other files.</p>}
    </div>
  );
}

/** Side-by-side comparison of an older version with the current one. */
export function CompareVersions({
  state,
  target,
  onClose,
  onError,
}: {
  state: PublicState;
  target: { fileId: string; version?: number } | null;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const file = state.files.find((f) => f.id === target?.fileId);
  const { detail } = useFileDetail(file?.id ?? null, state.revision);
  const current = file?.version ?? 1;
  const initial = target?.version && target.version !== current ? target.version : Math.max(1, current - 1);
  const [before, setBefore] = useState(initial);
  useEffect(() => setBefore(initial), [initial, target?.fileId]);
  const versions = detail?.versions ?? [];
  return (
    <Dialog
      open={!!file}
      onOpenChange={(open) => !open && onClose()}
      title={file ? `Compare versions of ${file.name}` : "Compare versions"}
      description="An older version next to the current one."
      wide
    >
      {file && (
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            Compare
            <select
              value={before}
              onChange={(e) => setBefore(Number(e.target.value))}
              className="h-9 rounded-lg border border-line bg-card px-2 text-[13px]"
            >
              {versions.filter((v) => v.number !== current).map((v) => (
                <option key={v.id} value={v.number}>Version {v.number}</option>
              ))}
              {!versions.length && <option value={before}>Version {before}</option>}
            </select>
            with the current version ({current})
          </label>
          {!detail ? (
            <Skeleton className="h-64 w-full" />
          ) : isDocument(file) ? (
            <DocumentDiff file={file} before={before} after={current} />
          ) : (
            <AssetCompare state={state} file={file} versions={versions} before={before} after={current} onError={onError} />
          )}
        </div>
      )}
    </Dialog>
  );
}
