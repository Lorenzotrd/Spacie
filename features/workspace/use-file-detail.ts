"use client";
import { useCallback, useEffect, useState } from "react";
import type { FileDetail } from "@/lib/types";

/** Loads a file's body, comments and versions; reloads whenever the workspace revision moves. */
export function useFileDetail(fileId: string | null, revision: number | undefined) {
  const [detail, setDetail] = useState<FileDetail | null>(null);
  useEffect(() => {
    if (!fileId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/files?id=${fileId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FileDetail | null) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fileId, revision]);
  const current = detail?.file.id === fileId ? detail : null;
  const loadVersion = useCallback(
    async (number: number) => {
      if (!fileId) return null;
      const r = await fetch(`/api/files?id=${fileId}&version=${number}`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { content: string }).content : null;
    },
    [fileId],
  );
  return { detail: current, loadVersion };
}

/** Debounced server-side file search for the command palette. */
export function useFileSearch<T>(query: string, delay = 200) {
  const [results, setResults] = useState<T[]>([]);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: T[]) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => undefined);
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, delay]);
  return results;
}
