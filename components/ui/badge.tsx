import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "type" | "accent" | "success" | "count" | "neutral";

const tones: Record<Tone, string> = {
  /** File type tag such as PPTX, in monospace. */
  type: "rounded-md bg-segment px-2 py-[3px] font-mono text-[11px] font-medium text-ink-2",
  accent: "rounded-full bg-accent-soft px-[9px] py-[3px] text-xs font-medium text-accent-hover",
  success: "rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success",
  count: "rounded-full bg-accent px-[7px] py-px text-[11px] font-semibold text-white",
  neutral: "rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-hover",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", tones[tone], className)} {...props} />;
}
