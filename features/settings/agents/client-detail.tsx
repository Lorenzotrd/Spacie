"use client";
import type { Principal, PublicState } from "@/lib/types";
import type { Command, CommandResult } from "@/lib/service";
import { CodeBlock } from "@/components/ui/code-block";
import { AgentAccessCard } from "./agent-access-card";
import { ClientLogo } from "./client-logo";
import type { ClientGuide } from "./catalog";
import { TokenForm } from "./token-form";

/** One client's guide: how to connect it, and the rights of its connected agents. */
export function ClientDetail({
  state,
  client,
  agents,
  mcpUrl,
  canManage,
  mutate,
  run,
  onError,
}: {
  state: PublicState;
  client: ClientGuide;
  agents: Principal[];
  mcpUrl: string;
  canManage: boolean;
  mutate: (c: Command) => Promise<CommandResult>;
  run: (c: Command, success: string) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[18px] overflow-y-auto rounded-2xl border border-line-soft bg-card p-[22px]">
      <div className="flex items-center gap-3.5">
        <ClientLogo client={client} connected={!!agents.length} size="lg" />
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-[19px] font-semibold tracking-[-0.01em]">{client.name}</h2>
          <span className="text-[13px] text-muted">{client.via}</span>
        </div>
      </div>
      <section aria-label="How to connect" className="flex flex-col gap-2.5">
        <h3 className="m-0 text-[13px] font-semibold">How to connect it</h3>
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {client.steps.map((text, i) => (
            <li key={text} className="flex items-start gap-2.5">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-hover">
                {i + 1}
              </span>
              <span className="text-[13px] leading-normal text-ink-2">{text}</span>
            </li>
          ))}
        </ol>
      </section>
      <CodeBlock label={client.codeLabel} code={client.code(mcpUrl)} />
      {client.auth === "token" && canManage && (
        <TokenForm key={client.id} state={state} client={client} mcpUrl={mcpUrl} mutate={mutate} onError={onError} />
      )}
      {agents.map((a) => (
        <AgentAccessCard key={a.id} state={state} agent={a} canManage={canManage} run={run} />
      ))}
      {!agents.length && client.auth === "oauth" && (
        <p className="text-[13px] text-muted">Not connected yet. Its rights appear here once you approve it.</p>
      )}
    </div>
  );
}
