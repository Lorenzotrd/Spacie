"use client";
import { useCallback, useEffect, useState } from "react";
import type { FileDetail } from "@/lib/types";

/** Loads a file's body, comments and versions; reloads whenever the workspace revision moves. */
export function useFileDetail(fileId: string | null, revision: number | undefined) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [error, setError] = useState<{ fileId: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!fileId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/files?id=${fileId}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? "Could not open this file.");
        return data as FileDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setError(null);
      })
      .catch((e: Error) => {
        // Keep showing what loaded before; only report when nothing did.
        if (!cancelled) setError({ fileId, message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, revision, attempt]);
  const current = detail?.file.id === fileId ? detail : null;
  const loadVersion = useCallback(
    async (number: number) => {
      if (!fileId) return null;
      const r = await fetch(`/api/files?id=${fileId}&version=${number}`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { content: string }).content : null;
    },
    [fileId],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return {
    detail: current,
    detailError: !current && error?.fileId === fileId ? error.message : "",
    retryDetail: retry,
    loadVersion,
  };
}

export type SearchStatus = "idle" | "loading" | "ready" | "error";

/** Debounced server-side file search, with its status for loading and error states. */
export function useFileSearchState<T>(query: string, delay = 200) {
  const [results, setResults] = useState<T[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error("Search failed");
          return r.json() as Promise<T[]>;
        })
        .then((data) => {
          if (cancelled) return;
          setResults(data);
          setStatus("ready");
        })
        .catch(() => !cancelled && setStatus("error"));
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, delay]);
  return { results, status };
}

/** Debounced server-side file search for the command palette. */
export function useFileSearch<T>(query: string, delay = 200) {
  return useFileSearchState<T>(query, delay).results;
}
