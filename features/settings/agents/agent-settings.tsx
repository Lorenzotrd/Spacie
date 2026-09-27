"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, History, Plus, ShieldCheck } from "lucide-react";
import type { Command } from "@/lib/service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { SettingsShell } from "../settings-shell";
import { CLIENTS, clientById, clientOf, type ClientId } from "./catalog";
import { ClientDetail } from "./client-detail";
import { ClientLogo } from "./client-logo";

const PILLARS = [
  { icon: BadgeCheck, title: "A name for every agent", text: "You always know who did what." },
  { icon: ShieldCheck, title: "Rights per project", text: "Read, comment or edit." },
  { icon: History, title: "Tamper-proof history", text: "Every change saves a version." },
];

export function AgentSettings() {
  const ws = useWorkspace();
  const { state, setError, setNotice, mutate } = ws;
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

  const pick = (id: ClientId) => {
    setSelected(id);
    if (window.matchMedia("(max-width: 767px)").matches) detail.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <SettingsShell
      ws={ws}
      section="agents"
      title="AI agents"
      description="Connect your AIs as team members. Each has its own name, rights and history."
      action={({ canManage }) =>
        canManage && (
          <Button variant="primary" size="lg" onClick={() => pick("other")}>
            <Plus size={15} aria-hidden />
            Connect an agent
          </Button>
        )
      }
    >
      {({ state, canManage }) => {
        const connected = state.principals.filter((p) => p.type === "agent" && p.status !== "offline");
        const byClient = (id: ClientId) => connected.filter((a) => clientOf(a) === id);
        const client = clientById(selected);
        const mcpUrl = state.mcpUrl ?? `${window.location.origin}/api/mcp`;
        const available = CLIENTS.length - CLIENTS.filter((c) => byClient(c.id).length).length;
        return (
          <>
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
            <div className="flex flex-col gap-5 md:flex-row">
              <div className="flex shrink-0 flex-col gap-2 md:w-[400px] xl:w-[440px]">
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
              <div ref={detail} className="flex min-w-0 flex-1 scroll-mt-4 self-start">
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
          </>
        );
      }}
    </SettingsShell>
  );
}
