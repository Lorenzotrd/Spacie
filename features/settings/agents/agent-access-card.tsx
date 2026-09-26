"use client";
import { useState } from "react";
import type { Principal, PublicState } from "@/lib/types";
import type { Command } from "@/lib/service";
import { agentAccess, type AccessLevel } from "@/lib/access-levels";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { relativeTime } from "@/features/workspace/derive";
import { ProjectPicker } from "./project-picker";

export const LEVELS: { id: AccessLevel; label: string }[] = [
  { id: "read", label: "Read" },
  { id: "comment", label: "Comment" },
  { id: "write", label: "Edit" },
];

type Run = (command: Command, success: string) => Promise<boolean>;

/** A connected agent's rights. Every control saves immediately through update_agent. */
export function AgentAccessCard({
  state,
  agent,
  canManage,
  run,
}: {
  state: PublicState;
  agent: Principal;
  canManage: boolean;
  run: Run;
}) {
  const access = agentAccess(state.grants, agent.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(access.projectIds);
  const [draftAll, setDraftAll] = useState(access.allProjects);
  const [busy, setBusy] = useState(false);
  const lastAction = state.activity.find((a) => a.actorId === agent.id);
  const save = async (patch: Partial<Command>, success: string) => {
    setBusy(true);
    const ok = await run({ action: "update_agent", id: agent.id, ...patch }, success);
    setBusy(false);
    return ok;
  };
  const visible = access.allProjects
    ? [{ id: "all", name: "All projects" }]
    : state.projects.filter((p) => access.projectIds.includes(p.id));
  const row = "flex min-h-11 items-center gap-3";

  return (
    <section aria-label={`${agent.name} access`} className="flex flex-col gap-3 border-t border-divider pt-4">
      <div className="flex items-center gap-3">
        <Avatar person={agent} size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{agent.name}</span>
          <span className="text-xs text-muted">
            {lastAction ? `Last: ${lastAction.action} ${lastAction.name} · ${relativeTime(lastAction.createdAt)}` : "No activity yet"}
          </span>
        </div>
        <Badge tone="success">
          <span aria-hidden className="size-1.5 rounded-full bg-success" />
          Connected
        </Badge>
      </div>
      {access.fullAccess && (
        <p className="rounded-lg bg-accent-tint px-3 py-2 text-xs text-ink-2">
          This agent has full workspace access. Changing a setting below replaces it with the level you pick.
        </p>
      )}
      <div className={row}>
        <span className="flex-1 text-[13px] text-ink-2">Can</span>
        <Tabs
          label={`${agent.name} access level`}
          items={LEVELS}
          value={access.level}
          onChange={(level) => canManage && !busy && void save({ access: level }, `${agent.name} can now ${level === "write" ? "edit" : level}`)}
        />
      </div>
      <div className={row}>
        <span className="flex-1 text-[13px] text-ink-2">Visible projects</span>
        <div className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
          {visible.map((p) => (
            <Badge key={p.id} tone="accent">{p.name}</Badge>
          ))}
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setDraft(access.projectIds);
              setDraftAll(access.allProjects);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        )}
      </div>
      <div className={row}>
        <span className="flex-1 text-[13px] text-ink-2">Can create public links</span>
        <Toggle
          checked={access.publish}
          disabled={!canManage || busy}
          label={`Allow ${agent.name} to create public links`}
          onChange={(on) => void save({ allowPublish: on }, on ? "Public links allowed" : "Public links turned off")}
        />
      </div>
      {canManage && (
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => void run({ action: "disconnect_agent", id: agent.id }, `${agent.name} disconnected`)}
          >
            Disconnect
          </Button>
        </div>
      )}
      {!canManage && <p className="text-xs text-muted">Only owners and admins can change an agent&apos;s access.</p>}
      <Dialog open={editing} onOpenChange={setEditing} title={`Projects ${agent.name} can see`} description="It keeps its level on each project you pick.">
        <div className="flex flex-col gap-4">
          <ProjectPicker projects={state.projects} selected={draft} onChange={setDraft} all={draftAll} onAllChange={setDraftAll} />
          <Button
            variant="primary"
            size="lg"
            disabled={busy || (!draftAll && !draft.length)}
            onClick={async () => {
              const ok = await save(draftAll ? { fullAccess: true } : { scope: draft }, "Projects updated");
              if (ok) setEditing(false);
            }}
          >
            Save projects
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
