"use client";
import { useState, type FormEvent } from "react";
import type { PublicState } from "@/lib/types";
import type { Command, CommandResult } from "@/lib/service";
import { permissionsFor, type AccessLevel } from "@/lib/access-levels";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { LEVELS } from "./agent-access-card";
import { providerFor, type ClientGuide } from "./catalog";
import { ProjectPicker } from "./project-picker";

/** Creates a token-based agent. The token is shown once, inside the config to copy. */
export function TokenForm({
  state,
  client,
  mcpUrl,
  mutate,
  onError,
}: {
  state: PublicState;
  client: ClientGuide;
  mcpUrl: string;
  mutate: (c: Command) => Promise<CommandResult>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(client.id === "other" ? "" : client.name);
  const [level, setLevel] = useState<AccessLevel>(state.agentDefaults?.access ?? "write");
  const [projects, setProjects] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [publish, setPublish] = useState(state.agentDefaults?.allowPublish ?? false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await mutate({
        action: "connect_agent",
        name: name.trim(),
        provider: providerFor(client.id),
        permissions: permissionsFor(level, publish),
        scope: all ? [] : projects,
        fullAccess: all,
      });
      if (!result.token) throw new Error("The server did not return a token.");
      // connect_agent's all-projects grant is unrestricted; narrow it to the chosen level.
      if (all) await mutate({ action: "update_agent", id: result.id, fullAccess: true, access: level, allowPublish: publish });
      setToken(result.token);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not create the agent.");
    } finally {
      setBusy(false);
    }
  };

  if (token)
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="text-[0.8125rem] font-medium text-success">
          {name} is ready. Copy this now: the token will not be shown again.
        </p>
        <CodeBlock label={client.codeLabel} code={client.code(mcpUrl, token)} />
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-line-soft bg-subtle p-4">
      <span className="text-[0.8125rem] font-semibold">Generate an agent token</span>
      <label className="flex flex-col gap-1.5 text-[0.8125rem] font-medium text-ink">
        Name in Spacie
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ops agent"
          className="h-10 rounded-control border border-line bg-card px-3 text-[0.8125rem] font-normal outline-none focus:border-accent"
        />
      </label>
      <div className="flex min-h-11 items-center gap-3">
        <span className="flex-1 text-[0.8125rem] text-ink-2">Can</span>
        <Tabs label="Access level" items={LEVELS} value={level} onChange={setLevel} />
      </div>
      <ProjectPicker projects={state.projects} selected={projects} onChange={setProjects} all={all} onAllChange={setAll} />
      <div className="flex min-h-11 items-center gap-3">
        <span className="flex-1 text-[0.8125rem] text-ink-2">Can create public links</span>
        <Toggle checked={publish} onChange={setPublish} label="Allow public links" />
      </div>
      <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim() || (!all && !projects.length)}>
        {busy ? "Creating…" : "Generate token"}
      </Button>
    </form>
  );
}
