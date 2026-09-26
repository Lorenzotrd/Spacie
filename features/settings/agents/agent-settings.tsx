"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, History, Plus, ShieldCheck } from "lucide-react";
import type { Command } from "@/lib/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { SettingsNav } from "../settings-nav";
import { CLIENTS, clientById, clientOf, type ClientId } from "./catalog";
import { ClientDetail } from "./client-detail";
import { ClientLogo } from "./client-logo";

const PILLARS = [
  { icon: BadgeCheck, title: "A name for every agent", text: "You always know who did what." },
  { icon: ShieldCheck, title: "Rights per project", text: "Read, comment or edit." },
  { icon: History, title: "Tamper-proof history", text: "Every change saves a version." },
];

export function AgentSettings() {
  const { state, error, setError, notice, setNotice, mutate, refresh } = useWorkspace();
  const [selected, setSelected] = useState<ClientId>("claude");
  const detail = useRef<HTMLDivElement>(null);

  // /settings/agents?agent=<id> opens that agent's guide (links from the sidebar and search).
  const linked = useRef(false);
  useEffect(() => {
    if (!state || linked.current) return;
    linked.current = true;
    const id = new URLSearchParams(window.location.search).get("agent");
    const agent = state.principals.find((p) => p.id === id && p.type === "agent");
    if (agent) setSelected(clientOf(agent));
  }, [state]);

  const run = useCallback(
    async (command: Command, success: string) => {
      try {
        await mutate(command);
        setNotice(success);
        return true;
      } catch {
        return false; // mutate already surfaced the error
      }
    },
    [mutate, setNotice],
  );

  if (!state)
    return (
      <div className="flex h-dvh items-center justify-center bg-app p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void refresh(true).then(() => setError(""), (e: Error) => setError(e.message))} />
        ) : (
          <div role="status" aria-label="Loading settings" className="flex w-72 flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
      </div>
    );

  const me = state.principals.find((p) => p.id === state.currentPrincipalId);
  const canManage = me?.role === "owner" || me?.role === "admin";
  const connected = state.principals.filter((p) => p.type === "agent" && p.status !== "offline");
  const byClient = (id: ClientId) => connected.filter((a) => clientOf(a) === id);
  const client = clientById(selected);
  const mcpUrl = state.mcpUrl ?? `${window.location.origin}/api/mcp`;
  const pick = (id: ClientId) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 767px)").matches) detail.current?.scrollIntoView({ behavior: "smooth" });
  };
  const available = CLIENTS.length - CLIENTS.filter((c) => byClient(c.id).length).length;

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 bg-app p-3.5 md:h-dvh md:flex-row">
      <SettingsNav me={me} workspace={state.workspace.name} agentCount={connected.length} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-panel border border-line bg-panel">
        <div className="flex flex-col gap-[22px] px-4 pt-6 md:px-7 md:pt-[30px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13px] text-muted">Settings / Workspace</span>
              <h1 className="m-0 text-[30px] font-semibold tracking-[-0.025em]">AI agents</h1>
              <p className="text-sm text-muted">Connect your AIs as team members. Each has its own name, rights and history.</p>
            </div>
            {canManage && (
              <Button variant="primary" size="lg" onClick={() => pick("other")}>
                <Plus size={15} aria-hidden />
                Connect an agent
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-center gap-3 rounded-card border border-accent-border bg-accent-tint px-4 py-3.5">
                <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-white">
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-xs text-[#4a4d57]">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pt-[22px] pb-7 md:flex-row md:px-7">
          <div className="flex shrink-0 flex-col gap-2 md:w-[440px]">
            <p className="px-0.5 pb-1 text-[13px] text-muted">
              {connected.length} connected · {available} available
            </p>
            {CLIENTS.map((c) => {
              const agents = byClient(c.id);
              const active = c.id === selected;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-card bg-card px-3.5 text-left",
                    active ? "border-[1.5px] border-accent shadow-[0_0_0_3px_#eaeffc]" : "border border-line-soft hover:border-line",
                  )}
                >
                  <ClientLogo client={c} connected={!!agents.length} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-ink">{c.name}</span>
                    <span className="truncate text-xs text-muted">{c.via}</span>
                  </span>
                  {agents.length ? (
                    <Badge tone="success">
                      <span aria-hidden className="size-1.5 rounded-full bg-success" />
                      {agents.length > 1 ? `${agents.length} connected` : "Connected"}
                    </Badge>
                  ) : (
                    <span className="text-xs font-medium text-accent-hover">Connect</span>
                  )}
                </button>
              );
            })}
          </div>
          <div ref={detail} className="flex min-w-0 flex-1 scroll-mt-4">
            <ClientDetail
              key={client.id}
              state={state}
              client={client}
              agents={byClient(client.id)}
              mcpUrl={mcpUrl}
              canManage={canManage}
              mutate={mutate}
              run={run}
              onError={setError}
            />
          </div>
        </div>
      </main>
      {(error || notice) && (
        <div role={error ? "alert" : "status"} className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">
            {error || notice}
            {error && (
              <button type="button" onClick={() => setError("")} className="min-h-8 rounded-lg px-2 text-white/80 hover:bg-white/10">
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
