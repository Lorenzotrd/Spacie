"use client";
import { useCallback, useEffect, useState } from "react";
import type { FeedKind, ProjectComment, ProjectVersion } from "@/lib/project-feed";

type Result<K extends FeedKind> = K extends "comments" ? ProjectComment[] : ProjectVersion[];
export type FeedState<K extends FeedKind> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: Result<K> };

/** A project's latest comments or versions; reloads when the workspace revision moves. */
export function useProjectFeed<K extends FeedKind>(
  projectId: string | null,
  kind: K,
  revision: number | undefined,
  enabled = true,
) {
  const [feed, setFeed] = useState<FeedState<K>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!projectId || !enabled) return;
    let cancelled = false;
    fetch(`/api/project-feed?projectId=${projectId}&kind=${kind}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? "Could not load this list.");
        return data as Result<K>;
      })
      .then((items) => !cancelled && setFeed({ status: "ready", items }))
      .catch((e: Error) => !cancelled && setFeed({ status: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [projectId, kind, revision, enabled, attempt]);
  const retry = useCallback(() => {
    setFeed({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { feed, retry };
}
