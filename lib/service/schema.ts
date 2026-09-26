import { z } from "zod";
import type { Action } from "../types";
import { actions } from "../types";

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
      "update_agent",
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
    /** update_agent: the agent's level, and whether it may create public links. */
    access: z.enum(["read", "comment", "write"]).optional(),
    allowPublish: z.boolean().optional(),
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
export type CommandResult = { id: string; version?: number; token?: string };
