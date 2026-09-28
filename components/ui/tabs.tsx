"use client";
import { useRef, type KeyboardEvent } from "react";
import { cn } from "./cn";

export type TabItem<T extends string> = { id: T; label: string; count?: number };

/**
 * Segmented control, or page tabs with an underline (`variant="underline"`). Arrow keys move between tabs; the list filters or switches
 * whatever `onChange` controls, so callers own the state.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  stretch = false,
  size = "md",
  variant = "segmented",
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  stretch?: boolean;
  size?: "md" | "touch";
  variant?: "segmented" | "underline";
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
  const underline = variant === "underline";
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        underline ? "flex items-end gap-7 border-b border-[#eceae4]" : "flex gap-0.5 rounded-control bg-segment p-[0.1875rem]",
        stretch && "w-full",
        className,
      )}
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
              "flex items-center justify-center whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-accent",
              stretch && "flex-1",
              underline
                ? cn(
                    "-mb-px h-[2.625rem] gap-2 border-b-2 px-0.5 text-sm",
                    active ? "border-accent font-semibold text-accent-hover" : "border-transparent text-ink-2 hover:text-ink",
                  )
                : cn(
                    "gap-1.5 rounded-lg px-3 text-[0.8125rem]",
                    size === "touch" ? "h-11 text-sm" : "h-8",
                    active
                      ? "bg-card font-medium text-ink shadow-[0_1px_2px_rgba(23,24,28,0.08)]"
                      : "bg-transparent text-ink-2 hover:text-ink",
                  ),
            )}
          >
            {t.label}
            {t.count !== undefined &&
              (underline ? (
                <span className="rounded-full bg-segment px-[0.4375rem] py-px font-mono text-[0.6875rem] font-normal text-muted">
                  {t.count}
                </span>
              ) : (
                <span className="font-mono text-[0.6875rem] text-muted">{t.count}</span>
              ))}
          </button>
        );
      })}
    </div>
  );
}
