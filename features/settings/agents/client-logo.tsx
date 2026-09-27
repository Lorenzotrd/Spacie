import { cn } from "@/components/ui/cn";
import type { ClientGuide } from "./catalog";

/** Monogram tile for a client; blue once one of its agents is connected. */
export function ClientLogo({ client, connected, size = "md" }: { client: ClientGuide; connected: boolean; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-mono font-medium",
        size === "lg" ? "size-12 rounded-[14px] text-base" : "size-10 rounded-[11px] text-[13px]",
        connected ? "bg-accent text-white" : "bg-[#f1f0ec] text-ink-2",
      )}
    >
      {client.initial}
    </span>
  );
}
