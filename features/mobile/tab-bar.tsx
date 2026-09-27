"use client";
import { Activity, Folder, House, Plus, type LucideIcon } from "lucide-react";
import type { Principal } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import type { View } from "@/features/workspace/use-controller";

type Tab = { view: View; label: string; icon: LucideIcon | "me" };
const LEFT: Tab[] = [
  { view: "home", label: "Home", icon: House },
  { view: "space", label: "Projects", icon: Folder },
];
const RIGHT: Tab[] = [
  { view: "activity", label: "Activity", icon: Activity },
  { view: "me", label: "Me", icon: "me" },
];

/** Fixed bottom navigation with the central upload button. Every target is at least 44px. */
export function TabBar({
  current,
  me,
  unread,
  onNavigate,
  onAdd,
  busy,
}: {
  current: View;
  me: Principal | undefined;
  unread: boolean;
  onNavigate: (view: View) => void;
  onAdd: () => void;
  busy: boolean;
}) {
  const item = (t: Tab) => {
    const active = current === t.view || (t.view === "space" && current === "projects");
    const Icon = t.icon;
    return (
      <button
        key={t.view}
        type="button"
        onClick={() => onNavigate(t.view)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-[3.25rem] w-[3.75rem] flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
          active ? "text-accent" : "text-muted",
        )}
      >
        {Icon === "me" ? <Avatar person={me} size="sm" className="size-[1.375rem] text-[0.6875rem]" /> : <Icon size={22} strokeWidth={1.9} aria-hidden />}
        {t.label}
        {t.view === "activity" && unread && (
          <span className="absolute top-1 right-3.5 size-2 rounded-full border-2 border-card bg-accent" role="img" aria-label="New activity" />
        )}
      </button>
    );
  };
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#eceae4] bg-card px-3 pt-2 pb-[calc(6px+env(safe-area-inset-bottom,0px))]"
    >
      {LEFT.map(item)}
      <button
        type="button"
        aria-label="Add a file"
        onClick={onAdd}
        disabled={busy}
        className="flex size-[3.25rem] items-center justify-center rounded-2xl bg-accent text-white shadow-[0_6px_16px_rgba(43,89,217,0.3)] disabled:opacity-60"
      >
        <Plus size={22} strokeWidth={2.2} aria-hidden />
      </button>
      {RIGHT.map(item)}
    </nav>
  );
}
