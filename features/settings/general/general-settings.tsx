"use client";
import { useState, type FormEvent } from "react";
import type { AgentDefaults } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { postJson } from "../api";
import { Field, SettingRow, SettingsCard } from "../parts";
import { SettingsShell } from "../settings-shell";

const ACCESS = [
  { id: "read", label: "Read" },
  { id: "comment", label: "Comment" },
  { id: "write", label: "Edit" },
] as const;
const FALLBACK: AgentDefaults = { access: "write", allowPublish: false, readInstructions: true };

/** The workspace's name and what new agents start with. Owners and admins only. */
export function GeneralSettings() {
  const ws = useWorkspace();
  const run = async (body: object, done: string) => {
    try {
      await postJson("/api/workspaces", body);
      await ws.refresh(true);
      ws.setNotice(done);
    } catch (e) {
      ws.setError(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    }
  };
  return (
    <SettingsShell ws={ws} section="general" title="General" description="Your workspace name and defaults.">
      {({ state, canManage }) =>
        !state.account ? (
          <p className="text-sm text-muted">Sign in with your account to change the workspace settings.</p>
        ) : canManage ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <WorkspaceCard key={state.workspace.name} name={state.workspace.name} run={run} />
            <AgentDefaultsCard saved={state.agentDefaults ?? FALLBACK} run={run} />
          </div>
        ) : (
          <p className="text-sm text-muted">Only owners and admins can change the workspace settings.</p>
        )
      }
    </SettingsShell>
  );
}

function WorkspaceCard({ name, run }: { name: string; run: (body: object, done: string) => Promise<void> }) {
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    run({ action: "rename", name: draft }, "Workspace renamed")
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  return (
    <SettingsCard title="Workspace">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-ink text-[1.625rem] font-bold text-white">
            {(draft.trim() || name)[0]?.toUpperCase()}
          </span>
          <p className="text-[0.8125rem] leading-normal text-muted">
            The workspace initial is its logo, for your team and on public links.
          </p>
        </div>
        <Field label="Workspace name" value={draft} onChange={(e) => setDraft(e.target.value)} required maxLength={80} />
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={busy || !draft.trim() || draft.trim() === name}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function AgentDefaultsCard({ saved, run }: { saved: AgentDefaults; run: (body: object, done: string) => Promise<void> }) {
  const [pending, setPending] = useState<Partial<AgentDefaults>>({});
  const current = { ...saved, ...pending };
  const change = (next: Partial<AgentDefaults>) => {
    setPending((p) => ({ ...p, ...next }));
    run({ action: "agent_defaults", ...current, ...next }, "Defaults saved")
      .catch(() => undefined)
      .finally(() => setPending({}));
  };
  return (
    <SettingsCard title="Defaults for new agents">
      <SettingRow label="New agents can" hint="You can change it per agent later.">
        <Tabs label="New agents can" items={[...ACCESS]} value={current.access} onChange={(access) => change({ access })} />
      </SettingRow>
      <SettingRow label="Create public links" hint="Let agents share files outside the workspace.">
        <Toggle checked={current.allowPublish} onChange={(allowPublish) => change({ allowPublish })} label="Create public links" />
      </SettingRow>
      <SettingRow label="Read project instructions" hint="Agents get each project’s instructions for AI before acting. Applies to every agent.">
        <Toggle checked={current.readInstructions} onChange={(readInstructions) => change({ readInstructions })} label="Read project instructions" />
      </SettingRow>
    </SettingsCard>
  );
}
