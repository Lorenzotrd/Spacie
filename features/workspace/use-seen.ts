"use client";
import { useCallback, useEffect, useState } from "react";

const PREFIX = "spacie:seen:";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * Remembers, in this browser, the last item of a feed the person has dealt with,
 * e.g. the agent action shown in the AI banner. A newer item shows again.
 */
export function useSeen(key: string) {
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => setSeen(read(key)), [key]);
  const markSeen = useCallback(
    (id: string) => {
      setSeen(id);
      try {
        window.localStorage.setItem(PREFIX + key, id);
      } catch {
        // Storage can be blocked (private mode); hiding still works for this visit.
      }
    },
    [key],
  );
  return { seen, markSeen };
}
