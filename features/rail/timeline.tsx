import type { ReactNode } from "react";
import type { Principal } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { SectionLabel } from "@/components/ui/card";
import { calendarDaysBetween, withZone } from "@/features/workspace/time-zone";

export function dayLabel(date: string, now = new Date()): string {
  const d = new Date(date);
  const days = calendarDaysBetween(d, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en", withZone({ weekday: "long", month: "short", day: "numeric" }));
}

/** Splits dated items into consecutive day groups, keeping their order. */
export function byDay<T>(items: readonly T[], dateOf: (t: T) => string): { label: string; items: T[] }[] {
  return items.reduce<{ label: string; items: T[] }[]>((groups, item) => {
    const label = dayLabel(dateOf(item));
    const last = groups[groups.length - 1];
    return last?.label === label
      ? [...groups.slice(0, -1), { label, items: [...last.items, item] }]
      : [...groups, { label, items: [item] }];
  }, []);
}

export function DayGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{label}</SectionLabel>
      <ol className="flex flex-col">{children}</ol>
    </section>
  );
}

/** One entry on the vertical timeline: avatar, a line of text, and when. */
export function TimelineItem({
  who,
  children,
  when,
  footer,
}: {
  who: Principal | undefined;
  children: ReactNode;
  when: string;
  footer?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex w-6 flex-col items-center">
        <Avatar person={who} size="sm" />
        <span aria-hidden className="min-h-3.5 w-px flex-1 bg-line-soft" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[0.1875rem] pb-[1.125rem]">
        <div className="text-[0.8125rem] leading-[1.45] text-[#55575f]">{children}</div>
        <time className="text-xs text-muted">{when}</time>
        {footer}
      </div>
    </li>
  );
}

export const timeOf = (date: string) =>
  new Date(date).toLocaleTimeString("en", withZone({ hour: "numeric", minute: "2-digit" }));
