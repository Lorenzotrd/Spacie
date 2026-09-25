"use client";
import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { PublicState } from "@/lib/types";
import type { Command } from "@/lib/service";
export function useWorkspace() {
  const [state, setState] = useState<PublicState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const interval = setInterval(() => refresh().catch(() => undefined), 4000);
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const workspaceId = state?.workspace.id,
    isDemo = state?.demo;
  useEffect(() => {
    if (
      !workspaceId ||
      isDemo ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return;
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const channel = client
      .channel("workspace-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspaces",
          filter: `id=eq.${workspaceId}`,
        },
        () => {
          void refresh().catch(() => undefined);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [workspaceId, isDemo, refresh]);
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
      return result as { id?: string; token?: string; version?: number };
    },
    [refresh],
  );
  return { state, error, setError, notice, setNotice, mutate, refresh };
}
