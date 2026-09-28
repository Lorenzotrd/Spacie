"use client";
import type { Principal, PublicState } from "@/lib/types";
import { agentAccess } from "@/lib/access-levels";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { projectMembers } from "@/features/workspace/derive";

const HUMAN_ROLE = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" } as const;
const HUMAN_ACCESS = { owner: "Admin", admin: "Admin", member: "Can edit", viewer: "Can view" } as const;
const AGENT_ACCESS = { write: "Can edit", comment: "Can comment", read: "Can view" } as const;

function describe(state: PublicState, p: Principal): { sub: string; access: string } {
  if (p.type === "agent")
    return { sub: p.provider ? `Connected via ${p.provider}` : "AI agent", access: AGENT_ACCESS[agentAccess(state.grants, p.id).level] };
  const role = p.role ?? "member";
  return { sub: HUMAN_ROLE[role], access: HUMAN_ACCESS[role] };
}

/** People and agents who can work in the project, with what each may do. */
export function MembersTab({
  state,
  projectId,
  onPerson,
}: {
  state: PublicState;
  projectId: string;
  onPerson: (p: Principal) => void;
}) {
  const members = projectMembers(state, projectId);
  return (
    <Card className="px-5 py-2">
      <ul className="m-0 list-none p-0">
        {members.map((m) => {
          const { sub, access } = describe(state, m);
          return (
            <li key={m.id} className="border-b border-[#f3f1ed] last:border-b-0">
              <button
                type="button"
                onClick={() => onPerson(m)}
                className="flex min-h-[3.875rem] w-full group-data-[density=compact]/app:min-h-12 items-center gap-3.5 text-left"
              >
                <Avatar person={m} size="lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-ink">{m.name}</span>
                  <span className="truncate text-xs text-muted">{sub}</span>
                </span>
                {m.type === "agent" && <Badge>AI</Badge>}
                <span className="flex h-8 items-center rounded-lg border border-line px-3 text-[0.8125rem] text-ink-2">
                  {access}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
