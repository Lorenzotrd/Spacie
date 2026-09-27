"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { agentAccess, type AccessLevel } from "@/lib/access-levels";
import type { PendingInvite, Team, TeamMember } from "@/lib/team";
import type { PublicState } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyText } from "@/components/ui/code-block";
import { Dialog } from "@/components/ui/dialog";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { relativeTime } from "@/features/workspace/derive";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { postJson, useJson } from "../api";
import { Pill, SettingsCard } from "../parts";
import { SettingsShell } from "../settings-shell";
import { InviteCard } from "./invite-card";
import { RoleSelect, type EditableRole } from "./role-select";

const LEVEL: Record<AccessLevel, string> = { read: "Read", comment: "Comment", write: "Edit" };
const ROLES = [
  { role: "Owner", text: "Everything, including adding and changing admins." },
  { role: "Admin", text: "Manage members, AI agents and public links. Sees every project." },
  { role: "Member", text: "Create, edit and share files in every project." },
  { role: "Viewer", text: "Read only." },
];

type Notify = { notify: (m: string) => void; fail: (m: string) => void };

export function MembersSettings() {
  const ws = useWorkspace();
  const team = useJson<Team>("/api/members");
  const invite = useRef<HTMLInputElement>(null);
  return (
    <SettingsShell
      ws={ws}
      section="members"
      title="Members"
      description="Who can see and edit this workspace."
      action={({ canManage }) =>
        canManage && (
          <Button variant="primary" size="lg" className="max-md:hidden" onClick={() => invite.current?.focus()}>
            <Plus size={15} aria-hidden />
            Invite people
          </Button>
        )
      }
    >
      {({ state, me, canManage }) =>
        team.data ? (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col gap-4">
              {canManage && (
                <InviteCard ref={invite} isOwner={me?.role === "owner"} onInvited={team.reload} notify={ws.setNotice} fail={ws.setError} />
              )}
              <MemberTable
                team={team.data}
                state={state}
                isOwner={me?.role === "owner"}
                reload={async () => {
                  await Promise.all([team.reload(), ws.refresh(true)]);
                }}
                notify={ws.setNotice}
                fail={ws.setError}
              />
            </div>
            <div className="flex flex-col gap-4">
              <SeatsCard team={team.data} />
              <SettingsCard title="Roles">
                {ROLES.map((r) => (
                  <div key={r.role} className="flex flex-col gap-1 rounded-xl bg-subtle p-3.5">
                    <span className="text-sm font-semibold">{r.role}</span>
                    <span className="text-[13px] leading-normal text-muted">{r.text}</span>
                  </div>
                ))}
              </SettingsCard>
            </div>
          </div>
        ) : team.error ? (
          <ErrorState message={team.error} onRetry={() => void team.reload()} />
        ) : (
          <div role="status" aria-label="Loading members" className="flex flex-col gap-3">
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        )
      }
    </SettingsShell>
  );
}

function SeatsCard({ team }: { team: Team }) {
  const people = team.members.filter((m) => m.type === "human").length;
  const agents = team.members.length - people;
  return (
    <SettingsCard title="Seats">
      <div className="flex items-baseline gap-2">
        <span className="text-[30px] font-semibold tracking-[-0.02em]">{people}</span>
        <span className="text-[13px] text-muted">
          {people === 1 ? "person" : "people"}
          {team.invitations.length > 0 && ` · ${team.invitations.length} invited`}
        </span>
      </div>
      <span className="text-[13px] leading-normal text-muted">
        {agents} AI {agents === 1 ? "agent" : "agents"} connected. AI agents never take a seat.
      </span>
    </SettingsCard>
  );
}

/** Mobile: who and actions on one line, role and last activity below. Desktop: four columns. */
function Row({ who, role, last, actions }: { who: ReactNode; role: ReactNode; last: ReactNode; actions: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-[#f3f1ed] px-4 py-3 not-first:border-t md:min-h-16 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_150px] md:px-[18px] md:py-2">
      {who}
      <div className="flex items-center gap-3 max-md:col-span-2 max-md:row-start-2 md:contents">
        <div>{role}</div>
        <span className="text-[13px] text-[#55575f]">{last}</span>
      </div>
      <div className="flex justify-end gap-1.5 max-md:col-start-2 max-md:row-start-1">{actions}</div>
    </li>
  );
}

function Who({ avatar, name, sub }: { avatar: ReactNode; name: string; sub: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted">{sub}</span>
      </div>
    </div>
  );
}

function MemberTable({
  team,
  state,
  isOwner,
  reload,
  notify,
  fail,
}: { team: Team; state: PublicState; isOwner: boolean; reload: () => Promise<void> } & Notify) {
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [busy, setBusy] = useState("");
  const act = async (key: string, body: object, done: string) => {
    setBusy(key);
    try {
      const result = await postJson<{ link?: string }>("/api/members", body);
      await reload();
      if (result.link) await copyText(result.link).then(() => notify(`${done} and copied`), () => notify(done));
      else notify(done);
      return true;
    } catch (e) {
      fail(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy("");
    }
  };
  const editable = (m: TeamMember) =>
    team.canManage && m.type === "human" && !m.you && m.role !== "owner" && (m.role !== "admin" || isOwner);

  return (
    <Card className="overflow-hidden">
      <div className="hidden h-[42px] grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_150px] items-center gap-3 border-b border-[#efede8] bg-subtle px-[18px] text-xs font-medium text-muted md:grid">
        <span>Member</span>
        <span>Role</span>
        <span>Last active</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="m-0 list-none p-0" aria-label="Members">
        {team.members.map((m) =>
          m.type === "agent" ? (
            <Row
              key={m.id}
              who={
                <Who
                  avatar={<Avatar person={{ type: "agent", name: m.name, initials: m.initials }} size="lg" className="size-9" />}
                  name={m.name}
                  sub={`AI agent${m.provider && m.provider !== "Custom" ? ` · ${m.provider}` : ""}`}
                />
              }
              role={<Pill tone="accent">Agent · {LEVEL[agentAccess(state.grants, m.id).level]}</Pill>}
              last={m.lastActiveAt ? relativeTime(m.lastActiveAt) : "Never"}
              actions={
                team.canManage && (
                  <Link href={`/settings/agents?agent=${m.id}`} className="flex min-h-9 items-center px-2 text-[13px] font-medium no-underline">
                    Manage
                  </Link>
                )
              }
            />
          ) : (
            <Row
              key={m.id}
              who={
                <Who
                  avatar={<Avatar person={{ type: "human", name: m.name, initials: m.initials }} size="lg" className="size-9" />}
                  name={m.name}
                  sub={m.you ? "You" : (m.email ?? "Member")}
                />
              }
              role={
                editable(m) ? (
                  <RoleSelect
                    value={m.role as EditableRole}
                    allowAdmin={isOwner}
                    disabled={busy === m.id}
                    label={`Role of ${m.name}`}
                    className="w-[130px]"
                    onChange={(role) => void act(m.id, { action: "change_role", id: m.id, role }, `${m.name} is now ${role === "admin" ? "an admin" : `a ${role}`}`)}
                  />
                ) : (
                  <Pill tone={m.role === "owner" ? "ink" : "accent"}>
                    <span className="capitalize">{m.role}</span>
                  </Pill>
                )
              }
              last={m.you ? "Now" : m.lastActiveAt ? relativeTime(m.lastActiveAt) : "Never"}
              actions={
                editable(m) && (
                  <FileMenu label={`Actions for ${m.name}`} items={[{ label: "Remove from workspace", danger: true, onSelect: () => setRemoving(m) }]} />
                )
              }
            />
          ),
        )}
        {team.invitations.map((i) => (
          <InviteRow key={i.id} invite={i} busy={busy === i.id} act={act} />
        ))}
      </ul>
      <Dialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description={`${removing?.name ?? "They"} loses access to ${state.workspace.name} right away.`}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-sm leading-normal text-ink-2">
            Their files, comments and history stay, under their name. Public links they created are turned off. You can invite
            them again later.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRemoving(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={!removing || busy === removing.id}
              onClick={() =>
                removing &&
                void act(removing.id, { action: "remove", id: removing.id }, `${removing.name} was removed`).then(
                  (ok) => ok && setRemoving(null),
                )
              }
            >
              Remove
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

function InviteRow({
  invite,
  busy,
  act,
}: {
  invite: PendingInvite;
  busy: boolean;
  act: (key: string, body: object, done: string) => Promise<boolean>;
}) {
  const who = invite.email ?? "Anyone with the link";
  return (
    <Row
      who={
        <Who
          avatar={
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#c9c5bc] text-muted">
              <Mail size={15} strokeWidth={1.8} aria-hidden />
            </span>
          }
          name={who}
          sub={`Invited ${relativeTime(invite.createdAt).toLowerCase()} · ${invite.role}`}
        />
      }
      role={<Pill tone="warning">Pending</Pill>}
      last={`Expires ${new Date(invite.expiresAt).toLocaleDateString("en", { month: "short", day: "numeric" })}`}
      actions={
        <>
          <Button
            size="sm"
            className="h-9"
            disabled={busy}
            onClick={() => void act(invite.id, { action: "renew_invite", id: invite.id }, "New invite link created")}
            aria-label={`Create a new invite link for ${who}`}
          >
            New link
          </Button>
          <FileMenu
            label={`Actions for the invitation of ${who}`}
            items={[
              {
                label: "Cancel invitation",
                danger: true,
                onSelect: () => void act(invite.id, { action: "revoke_invite", id: invite.id }, "Invitation cancelled"),
              },
            ]}
          />
        </>
      }
    />
  );
}
