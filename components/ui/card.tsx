import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-line-soft bg-card", className)}
      {...props}
    />
  );
}

/** Small uppercase label above a group, e.g. PROJECTS or TODAY. */
export function SectionLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase", className)}
      {...props}
    />
  );
}
