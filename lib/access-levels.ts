import type { Action, Grant } from "./types";

/** The three access levels offered for an agent, and the permissions each grants. */
export type AccessLevel = "read" | "comment" | "write";
export const ACCESS_LEVELS: Record<AccessLevel, Action[]> = {
  read: ["read"],
  comment: ["read", "comment"],
  write: ["read", "write", "create", "upload", "comment", "rename", "move", "create_folder"],
};

/** The highest level a permission list reaches. */
export function levelOf(allow: readonly Action[], fullAccess = false): AccessLevel {
  if (fullAccess || allow.includes("write")) return "write";
  return allow.includes("comment") ? "comment" : "read";
}

export type AgentAccess = {
  level: AccessLevel;
  /** Every project, including future ones. */
  allProjects: boolean;
  projectIds: string[];
  /** May create public share links. */
  publish: boolean;
  /** Unrestricted workspace grant (legacy "full access"): every action, everywhere. */
  fullAccess: boolean;
};

/** Summarizes an agent's grants into what the settings screen shows and edits. */
export function agentAccess(grants: readonly Grant[], agentId: string): AgentAccess {
  const own = grants.filter((g) => g.principalId === agentId);
  const workspace = own.find((g) => g.resourceType === "workspace");
  const projects = own.filter((g) => g.resourceType === "project");
  const allow = [...new Set(own.flatMap((g) => g.allow))];
  const fullAccess = own.some((g) => g.fullAccess);
  return {
    level: levelOf(allow, fullAccess),
    allProjects: !!workspace,
    projectIds: projects.map((g) => g.resourceId),
    publish: fullAccess || allow.includes("publish"),
    fullAccess,
  };
}

/** The permission list stored for a level, plus `publish` when allowed. */
export const permissionsFor = (level: AccessLevel, publish: boolean): Action[] => [
  ...ACCESS_LEVELS[level],
  ...(publish ? (["publish"] as Action[]) : []),
];
