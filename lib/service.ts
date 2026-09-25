import { randomUUID } from "node:crypto";
import { z } from "zod";
import { can, requirePermission } from "./permissions";
import { hashToken, newToken } from "./auth";
import type {
  Action,
  FileRecord,
  Principal,
  PublicState,
  WorkspaceState,
} from "./types";
import { actions } from "./types";
import { demo } from "./repository";
export const commandSchema = z
  .object({
    action: z.enum([
      "create_project",
      "create_folder",
      "create_document",
      "update_document",
      "rename_file",
      "move_file",
      "delete_file",
      "restore_file",
      "create_comment",
      "resolve_comment",
      "react_comment",
      "restore_version",
      "connect_agent",
      "rotate_token",
      "disconnect_agent",
      "upload_asset",
      "share",
    ]),
    id: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    folderId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1).max(180).optional(),
    content: z.string().max(2_000_000).optional(),
    version: z.number().int().positive().optional(),
    baseVersion: z.number().int().positive().optional(),
    provider: z.string().max(50).optional(),
    scope: z.array(z.string().uuid()).max(100).optional(),
    permissions: z.array(z.enum(actions as [Action, ...Action[]])).optional(),
    fullAccess: z.boolean().optional(),
    mime: z.string().max(120).optional(),
    size: z
      .number()
      .int()
      .min(0)
      .max(100 * 1024 * 1024)
      .optional(),
    storageKey: z.string().max(500).optional(),
    email: z.string().email().optional(),
    role: z.enum(["member", "viewer", "admin"]).optional(),
  })
  .strict();
export type Command = z.infer<typeof commandSchema>;
const now = () => new Date().toISOString();
const id = () => randomUUID();
export function publicState(s: WorkspaceState, actor: Principal): PublicState {
  const readable = (f: FileRecord) => can(s, actor, "read", f);
  const files = s.files.filter(readable);
  const fileIds = new Set(files.map((f) => f.id));
  return {
    workspace: s.workspace,
    revision: s.revision,
    currentPrincipalId: actor.id,
    demo: demo(),
    principals: s.principals,
    projects: s.projects.filter((p) =>
      can(s, actor, "read", { workspaceId: p.workspaceId, projectId: p.id }),
    ),
    folders: s.folders.filter((f) =>
      can(s, actor, "read", { ...f, folderId: f.id }),
    ),
    files,
    versions: s.versions.filter((v) => fileIds.has(v.fileId)),
    comments: s.comments.filter((c) => fileIds.has(c.fileId)),
    activity: s.activity.filter((a) =>
      a.fileId
        ? fileIds.has(a.fileId)
        : a.projectId
          ? can(s, actor, "read", {
              workspaceId: s.workspace.id,
              projectId: a.projectId,
            })
          : can(s, actor, "manage_members", { workspaceId: s.workspace.id }),
    ),
    grants: s.grants.filter(
      (g) =>
        g.principalId === actor.id ||
        can(s, actor, "manage_members", { workspaceId: s.workspace.id }),
    ),
  };
}
function record(
  s: WorkspaceState,
  actor: Principal,
  action: string,
  name: string,
  file?: FileRecord,
  projectId?: string,
) {
  s.activity.unshift({
    id: id(),
    actorId: actor.id,
    projectId: file?.projectId ?? projectId ?? null,
    fileId: file?.id ?? null,
    action,
    name,
    createdAt: now(),
  });
}
function snapshot(
  s: WorkspaceState,
  actor: Principal,
  f: FileRecord,
  message: string,
) {
  s.versions.push({
    id: id(),
    fileId: f.id,
    number: f.version,
    content: f.content,
    storageKey: f.storageKey,
    actorId: actor.id,
    createdAt: now(),
    message,
  });
}
function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === "")
    throw new Error(`${label} is required`);
  return value;
}
function destination(
  s: WorkspaceState,
  projectId: string,
  folderId: string | null,
) {
  if (
    !s.projects.some(
      (p) => p.id === projectId && p.workspaceId === s.workspace.id,
    )
  )
    throw new Error("Project not found");
  if (
    folderId &&
    !s.folders.some((f) => f.id === folderId && f.projectId === projectId)
  )
    throw new Error("Folder not found");
  return { workspaceId: s.workspace.id, projectId, folderId };
}
export function execute(
  s: WorkspaceState,
  actor: Principal,
  c: Command,
): Record<string, unknown> {
  if (
    !s.principals.some(
      (p) => p.id === actor.id && p.workspaceId === s.workspace.id,
    )
  )
    throw new Error("UNAUTHORIZED");
  const workspace = { workspaceId: s.workspace.id };
  if (c.action === "create_project") {
    requirePermission(s, actor, "manage_members", workspace);
    const project = {
      id: id(),
      workspaceId: s.workspace.id,
      name: required(c.name, "Name"),
      description: "A new space for your next idea.",
      color: "#8a73d5",
    };
    s.projects.push(project);
    record(s, actor, "created", project.name, undefined, project.id);
    return { id: project.id };
  }
  if (
    c.action === "connect_agent" ||
    c.action === "rotate_token" ||
    c.action === "disconnect_agent"
  ) {
    requirePermission(s, actor, "manage_members", workspace);
    let agent = s.principals.find((p) => p.id === c.id && p.type === "agent");
    if (c.action === "connect_agent") {
      const scopes = c.scope ?? [];
      if (!c.fullAccess && !scopes.length)
        throw new Error("Select at least one project.");
      for (const projectId of scopes) destination(s, projectId, null);
      agent = {
        id: id(),
        workspaceId: s.workspace.id,
        type: "agent",
        name: required(c.name, "Agent name"),
        initials: "✳",
        color: "#9a81bc",
        provider: c.provider ?? "Custom",
        status: "idle",
      };
      s.principals.push(agent);
      s.grants.push(
        ...(c.fullAccess
          ? [
              {
                id: id(),
                principalId: agent.id,
                resourceType: "workspace" as const,
                resourceId: s.workspace.id,
                allow: actions,
                fullAccess: true,
              },
            ]
          : scopes.map((projectId) => ({
              id: id(),
              principalId: agent!.id,
              resourceType: "project" as const,
              resourceId: projectId,
              allow:
                c.permissions ??
                (["read", "write", "create", "comment"] as Action[]),
              fullAccess: false,
            }))),
      );
    }
    if (!agent) throw new Error("Agent not found");
    s.tokens
      .filter((t) => t.principalId === agent.id && !t.revokedAt)
      .forEach((t) => (t.revokedAt = now()));
    if (c.action === "disconnect_agent") {
      agent.status = "offline";
      record(s, actor, "disconnected", agent.name);
      return { id: agent.id };
    }
    agent.status = "idle";
    const token = newToken();
    s.tokens.push({
      id: id(),
      principalId: agent.id,
      hash: hashToken(token),
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      revokedAt: null,
    });
    record(
      s,
      actor,
      c.action === "connect_agent" ? "connected" : "rotated credentials for",
      agent.name,
    );
    return { id: agent.id, token };
  }
  if (c.action === "share") {
    requirePermission(s, actor, "manage_members", workspace);
    throw new Error(
      "Email invitations require the configured Supabase invitation endpoint.",
    );
  }
  if (["create_folder", "create_document", "upload_asset"].includes(c.action)) {
    const projectId = required(c.projectId, "Project"),
      folderId = c.folderId ?? null;
    const resource = destination(s, projectId, folderId);
    requirePermission(
      s,
      actor,
      c.action === "create_folder"
        ? "create_folder"
        : c.action === "upload_asset"
          ? "upload"
          : "create",
      resource,
    );
    const name = required(c.name, "Name");
    if (c.action === "create_folder") {
      const folder = {
        id: id(),
        workspaceId: s.workspace.id,
        projectId,
        parentId: folderId,
        name,
      };
      s.folders.push(folder);
      record(s, actor, "created folder", name, undefined, projectId);
      return { id: folder.id };
    }
    const f: FileRecord = {
      id: id(),
      ...resource,
      folderId,
      name,
      mime:
        c.action === "upload_asset"
          ? required(c.mime, "File type")
          : "application/x-spacie-doc",
      size: c.size ?? 0,
      updatedBy: actor.id,
      updatedAt: now(),
      version: 1,
      deleted: false,
      content: c.content ?? "",
      storageKey: c.storageKey,
    };
    if (c.action === "upload_asset" && !c.storageKey)
      throw new Error("Upload must finish before creating the file.");
    s.files.push(f);
    snapshot(
      s,
      actor,
      f,
      c.action === "upload_asset" ? "Uploaded asset" : "Created document",
    );
    record(
      s,
      actor,
      c.action === "upload_asset" ? "uploaded" : "created",
      name,
      f,
    );
    return { id: f.id };
  }
  if (c.action === "resolve_comment" || c.action === "react_comment") {
    const comment = s.comments.find((x) => x.id === c.id);
    if (!comment) throw new Error("Comment not found");
    const f = s.files.find((x) => x.id === comment.fileId)!;
    requirePermission(s, actor, "comment", f);
    if (c.action === "resolve_comment") comment.resolved = !comment.resolved;
    else
      comment.reactions = comment.reactions.includes(actor.id)
        ? comment.reactions.filter((x) => x !== actor.id)
        : [...comment.reactions, actor.id];
    record(
      s,
      actor,
      c.action === "resolve_comment" ? "resolved comment on" : "reacted to",
      f.name,
      f,
    );
    return { id: comment.id };
  }
  const f = s.files.find((x) => x.id === c.id);
  if (!f) throw new Error("File not found");
  if (f.deleted && c.action !== "restore_file")
    throw new Error("File is in trash");
  const permission: Action =
    c.action === "update_document"
      ? "write"
      : c.action === "create_comment"
        ? "comment"
        : c.action === "rename_file"
          ? "rename"
          : c.action === "move_file"
            ? "move"
            : c.action === "delete_file"
              ? "delete"
              : "restore";
  requirePermission(s, actor, permission, f);
  switch (c.action) {
    case "update_document":
      if (f.mime !== "application/x-spacie-doc")
        throw new Error("Only native documents can be edited.");
      if (c.baseVersion !== f.version)
        throw new Error(
          "CONFLICT: This document changed. Reload before saving.",
        );
      f.content = required(c.content, "Content");
      f.version++;
      snapshot(s, actor, f, "Updated document");
      break;
    case "rename_file":
      f.name = required(c.name, "Name");
      break;
    case "move_file": {
      const target = destination(
        s,
        required(c.projectId, "Project"),
        c.folderId ?? null,
      );
      requirePermission(s, actor, "move", target);
      requirePermission(s, actor, "create", target);
      Object.assign(f, target);
      break;
    }
    case "delete_file":
      f.deleted = true;
      break;
    case "restore_file":
      f.deleted = false;
      break;
    case "restore_version": {
      const version = s.versions.find(
        (v) => v.fileId === f.id && v.number === c.version,
      );
      if (!version) throw new Error("Version not found");
      f.content = version.content;
      f.storageKey = version.storageKey;
      f.version++;
      snapshot(s, actor, f, `Restored version ${version.number}`);
      break;
    }
    case "create_comment": {
      if (
        c.parentId &&
        !s.comments.some((x) => x.id === c.parentId && x.fileId === f.id)
      )
        throw new Error("Reply does not belong to this file.");
      const comment = {
        id: id(),
        fileId: f.id,
        parentId: c.parentId ?? null,
        actorId: actor.id,
        content: required(c.content?.trim(), "Comment"),
        createdAt: now(),
        resolved: false,
        reactions: [],
      };
      if (comment.content.length > 10000)
        throw new Error("Comment is too long");
      s.comments.push(comment);
      record(s, actor, "commented on", f.name, f);
      return { id: comment.id };
    }
    default:
      throw new Error("Unsupported action");
  }
  f.updatedBy = actor.id;
  f.updatedAt = now();
  record(
    s,
    actor,
    (
      {
        update_document: "edited",
        rename_file: "renamed",
        move_file: "moved",
        delete_file: "deleted",
        restore_file: "restored",
        restore_version: "restored a version of",
      } as Record<string, string>
    )[c.action] ?? c.action,
    f.name,
    f,
  );
  return { id: f.id, version: f.version };
}
