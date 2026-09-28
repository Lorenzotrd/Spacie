"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicState } from "@/lib/types";
import type { Command, CommandResult } from "@/lib/service";
import { setDisplayTimeZone } from "./time-zone";

/** Revision checks are one indexed row read; the snapshot is refetched only on change. */
const POLL_MS = 4000;

export function useWorkspace() {
  const [state, setState] = useState<PublicState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  /** True while background refreshes fail; the last loaded data stays on screen. */
  const [offline, setOffline] = useState(false);
  const revision = useRef<number | null>(null);
  const refresh = useCallback(async (force = false) => {
    const since = !force && revision.current !== null ? `?since=${revision.current}` : "";
    const response = await fetch(`/api/workspace${since}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (data.unchanged) return;
    revision.current = data.revision;
    setDisplayTimeZone((data as PublicState).preferences?.timeZone);
    setState(data as PublicState);
  }, []);
  useEffect(() => {
    refresh(true).catch((e) => setError(e.message));
    const interval = setInterval(
      () => refresh().then(() => setOffline(false), () => setOffline(true)),
      POLL_MS,
    );
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const mutate = useCallback(
    async (command: Command) => {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error);
        throw new Error(result.error);
      }
      await refresh();
      return result as CommandResult;
    },
    [refresh],
  );
  return { state, error, setError, notice, setNotice, mutate, refresh, offline };
}
