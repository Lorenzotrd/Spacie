"use client";
import { cn } from "./cn";

/** An on/off switch. `label` is announced; show visible text next to it too. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[26px] w-11 shrink-0 rounded-full p-[3px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "justify-end bg-accent" : "justify-start bg-[#bdb9b0]",
      )}
    >
      <span className="size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
    </button>
  );
}
