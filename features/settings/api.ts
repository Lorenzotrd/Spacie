"use client";
import { useCallback, useEffect, useState } from "react";

/** Posts JSON to a settings route and returns its body, or throws the server's message. */
export async function postJson<T = unknown>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error ?? "Something went wrong").replace(/^(FORBIDDEN|UNAUTHORIZED): /, ""));
  return data as T;
}

/** Loads a settings route; `reload` refetches after a change. */
export function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body.error ?? "Could not load this page.").replace(/^(FORBIDDEN|UNAUTHORIZED): /, ""));
      setData(body as T);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this page.");
    }
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, reload };
}
