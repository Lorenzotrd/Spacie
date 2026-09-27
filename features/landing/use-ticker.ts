"use client";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/features/workspace/use-media-query";

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/**
 * A counter that goes up every `ms`, for the landing's looping demos. It stands still
 * when the visitor prefers reduced motion, when `running` is false, and while the tab
 * is hidden.
 */
export function useTicker(ms: number, running = true) {
  const [tick, setTick] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !running) return;
    const id = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, ms);
    return () => clearInterval(id);
  }, [ms, running, reduced]);
  return tick;
}
