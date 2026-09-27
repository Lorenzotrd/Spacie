"use client";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";

export type TabItem<T extends string> = { id: T; label: string; count?: number };

/**
 * Segmented control. Arrow keys move between tabs; the list filters or switches
 * whatever `onChange` controls, so callers own the state.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  stretch = false,
  size = "md",
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  stretch?: boolean;
  size?: "md" | "touch";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-0.5 rounded-control bg-segment p-[0.1875rem]", stretch && "w-full", className)}
    >
      {items.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 text-[0.8125rem] whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-accent",
              size === "touch" ? "h-11 text-sm" : "h-8",
              stretch && "flex-1",
              active
                ? "bg-card font-medium text-ink shadow-[0_1px_2px_rgba(23,24,28,0.08)]"
                : "bg-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="font-mono text-[0.6875rem] text-muted">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
