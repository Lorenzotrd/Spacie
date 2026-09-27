"use client";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { DropdownMenu as Menu } from "radix-ui";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import type { WorkspaceSummary } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/components/ui/cn";

async function post(body: object): Promise<void> {
  const r = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not change workspace.");
}

const Tile = ({ name, className }: { name: string; className?: string }) => (
  <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-[9px] bg-ink font-bold text-white", className)}>
    {name[0]?.toUpperCase() ?? "S"}
  </span>
);

/**
 * Lists the person's workspaces, switches between them and creates new ones.
 * `trigger` replaces the default card (the mobile header uses a square tile).
 */
export function WorkspaceSwitcher({
  current,
  onChanged,
  onError,
  trigger,
}: {
  current: { id: string; name: string };
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  trigger?: ReactNode;
}) {
  const [list, setList] = useState<WorkspaceSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetch("/api/workspaces", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setList, () => setList([]));
  }, []);
  useEffect(load, [load, current.id]);

  const run = async (body: object) => {
    setBusy(true);
    try {
      await post(body);
      await onChanged();
      load();
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not change workspace.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run({ action: "create", name })) {
      setCreating(false);
      setName("");
    }
  };

  return (
    <>
      <Menu.Root onOpenChange={(open) => open && load()}>
        <Menu.Trigger asChild>
          {trigger ?? (
            <button
              type="button"
              aria-label={`Workspace: ${current.name}. Switch or create a workspace`}
              className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card p-2.5 text-left hover:border-[#d6d3cb] focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Tile name={current.name} className="size-[34px] text-[15px]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-ink">{current.name}</span>
                <span className="text-xs text-muted">Workspace</span>
              </span>
              <ChevronsUpDown size={16} className="text-muted" aria-hidden />
            </button>
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={6}
            className="z-[60] min-w-[244px] rounded-xl border border-line bg-card p-1.5 shadow-[0_12px_32px_rgba(23,24,28,0.12)]"
          >
            <Menu.Label className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
              Workspaces
            </Menu.Label>
            {(list ?? [{ ...current, role: "member" as const, current: true }]).map((w) => (
              <Menu.Item
                key={w.id}
                disabled={busy}
                onSelect={() => !w.current && void run({ action: "switch", id: w.id })}
                className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm outline-none data-[highlighted]:bg-accent-tint"
              >
                <Tile name={w.name} className="size-7 text-xs" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-ink">{w.name}</span>
                  <span className="text-xs text-muted capitalize">{w.role}</span>
                </span>
                {w.current && <Check size={16} className="text-accent" aria-label="Open" />}
              </Menu.Item>
            ))}
            <Menu.Separator className="my-1 h-px bg-divider" />
            <Menu.Item
              onSelect={() => setCreating(true)}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-accent-hover outline-none data-[highlighted]:bg-accent-tint"
            >
              <span className="flex size-7 items-center justify-center rounded-lg border border-dashed border-[#c9cfe0]">
                <Plus size={14} aria-hidden />
              </span>
              New workspace
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="New workspace"
        description="A separate space with its own projects, people and agents. You will own it."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
            Name
            <input
              required
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client work"
              className="h-10 rounded-control border border-line bg-card px-3 text-sm font-normal outline-none focus:border-accent"
            />
          </label>
          <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
