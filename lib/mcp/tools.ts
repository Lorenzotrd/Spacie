import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Db } from "../db/client";
import { loadAccess } from "../access";
import { requirePermission } from "../permissions";
import {
  activityFeed,
  fileDetail,
  listFiles,
  searchFiles,
  snapshot,
} from "../queries";
import { commandSchema, execute, type Command } from "../service";
import { destination } from "../service/context";
import { storeAsset } from "../storage";
import type { Principal } from "../types";

const MAX_INLINE_UPLOAD = 5 * 1024 * 1024;

const id = z.string().uuid();
const fileId = id.describe("File id, from list_files or search_files.");
const projectId = id.describe("Project id, from list_projects.");
const folderId = id
  .nullable()
  .optional()
  .describe("Folder id, or null/omitted for the project root.");

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};
const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});
const fail = (message: string): ToolResult => ({ ...ok({ error: message }), isError: true });
const guard = async (run: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return ok(await run());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Action failed");
  }
};

type Mutation = {
  description: string;
  input: z.ZodRawShape;
  action: Command["action"];
};

const mutations: Record<string, Mutation> = {
  create_document: {
    action: "create_document",
    description: "Create a rich-text document (HTML) in a project or folder.",
    input: { projectId, folderId, name: z.string().min(1).max(180), content: z.string().max(2_000_000).optional() },
  },
  update_document: {
    action: "update_document",
    description:
      "Replace a document's HTML. Pass baseVersion from a fresh read_document; a stale version returns CONFLICT and you must re-read and merge.",
    input: { id: fileId, content: z.string().max(2_000_000), baseVersion: z.number().int().positive() },
  },
  create_folder: {
    action: "create_folder",
    description: "Create a folder in a project, optionally inside another folder (folderId).",
    input: { projectId, folderId, name: z.string().min(1).max(180) },
  },
  rename_file: {
    action: "rename_file",
    description: "Rename a file.",
    input: { id: fileId, name: z.string().min(1).max(180) },
  },
  move_file: {
    action: "move_file",
    description: "Move a file to another project or folder you can create in.",
    input: { id: fileId, projectId, folderId },
  },
  delete_file: {
    action: "delete_file",
    description: "Move a file to trash. It can be restored with restore_file.",
    input: { id: fileId },
  },
  restore_file: {
    action: "restore_file",
    description: "Restore a file from trash.",
    input: { id: fileId },
  },
  create_comment: {
    action: "create_comment",
    description: "Comment on a file, or reply to a comment on the same file with parentId.",
    input: { id: fileId, content: z.string().min(1).max(10_000), parentId: id.optional() },
  },
  restore_version: {
    action: "restore_version",
    description: "Restore a previous version (number from get_versions) as a new version.",
    input: { id: fileId, version: z.number().int().positive() },
  },
};

/** Builds a per-request MCP server bound to one authenticated agent. */
export function buildServer(db: Db, actor: Principal) {
  const server = new McpServer({ name: "spacie", version: "0.2.0" });
  const read = (name: string, description: string, input: z.ZodRawShape, run: (args: Record<string, unknown>) => Promise<unknown>) =>
    server.registerTool(name, { description, inputSchema: input }, (args) => guard(() => run(args)));
  const view = () => snapshot(db, actor);

  read("list_workspaces", "List the workspace you can access.", {}, async () => {
    const s = await view();
    return s.projects.length || s.files.length ? [s.workspace] : [];
  });
  read("list_projects", "List projects you can read.", {}, async () => (await view()).projects);
  read("list_folders", "List folders you can read, optionally in one project.", { projectId: projectId.optional() },
    async (a) => (await view()).folders.filter((f) => !a.projectId || f.projectId === a.projectId));
  read("list_files", "List files (metadata, no body). Filter by project and folder; folderId null means the project root.",
    { projectId: projectId.optional(), folderId },
    (a) => listFiles(db, actor, { projectId: a.projectId as string | undefined, folderId: a.folderId as string | null | undefined }));
  read("search_files", "Search file names, document text and comments. Prefix matching on words.",
    { query: z.string().min(1).max(500), projectId: projectId.optional() },
    (a) => searchFiles(db, actor, a.query as string, a.projectId as string | undefined));
  read("get_file", "Get a file's metadata (no body).", { id: fileId }, async (a) => {
    const detail = await fileDetail(db, actor, a.id as string);
    if (!detail) throw new Error("File not found or access denied");
    return { ...detail.file, content: undefined };
  });
  read("read_document", "Read a file including its HTML body and current version (use as baseVersion).", { id: fileId },
    async (a) => {
      const detail = await fileDetail(db, actor, a.id as string);
      if (!detail) throw new Error("File not found or access denied");
      return detail.file;
    });
  read("list_comments", "List a file's comments and replies.", { id: fileId }, async (a) => {
    const detail = await fileDetail(db, actor, a.id as string);
    if (!detail) throw new Error("File not found or access denied");
    return detail.comments;
  });
  read("get_versions", "List a file's versions (newest first, without bodies).", { id: fileId }, async (a) => {
    const detail = await fileDetail(db, actor, a.id as string);
    if (!detail) throw new Error("File not found or access denied");
    return detail.versions;
  });
  read("get_activity", "Recent activity you can see, optionally for one project.", { projectId: projectId.optional() },
    (a) => activityFeed(db, actor, a.projectId as string | undefined));
  read("get_workspace_context", "Workspace overview: projects, people and agents, and your grants.", {}, async () => {
    const s = await view();
    return { workspace: s.workspace, you: actor.id, projects: s.projects, principals: s.principals, grants: s.grants };
  });
  read("get_project_context", "A project's folders and files (metadata).", { projectId }, async (a) => {
    const s = await view();
    const project = s.projects.find((p) => p.id === a.projectId);
    if (!project) throw new Error("Project not found or access denied");
    return {
      project,
      folders: s.folders.filter((f) => f.projectId === project.id),
      files: s.files.filter((f) => f.projectId === project.id && !f.deleted),
    };
  });

  for (const [name, m] of Object.entries(mutations))
    server.registerTool(name, { description: m.description, inputSchema: m.input }, (args) =>
      guard(() => execute(db, actor, commandSchema.parse({ ...args, action: m.action }))),
    );

  server.registerTool(
    "upload_asset",
    {
      description:
        "Upload a binary asset up to 5 MB as base64. Larger files: multipart POST /api/assets with the same bearer token.",
      inputSchema: {
        projectId,
        folderId,
        name: z.string().min(1).max(180),
        mime: z.string().max(120).describe("e.g. image/png, application/pdf"),
        base64: z.string().max(7_000_000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
      },
    },
    (args) =>
      guard(async () => {
        const access = await loadAccess(db, actor);
        requirePermission(access, actor, "upload",
          await destination(db, access, args.projectId, args.folderId ?? null));
        const bytes = Buffer.from(args.base64, "base64");
        if (bytes.length > MAX_INLINE_UPLOAD)
          throw new Error("Use the multipart endpoint for files larger than 5 MB.");
        const storageKey = await storeAsset(new File([bytes], args.name, { type: args.mime }), actor.workspaceId);
        return execute(db, actor, {
          action: "upload_asset",
          projectId: args.projectId,
          folderId: args.folderId ?? null,
          name: args.name,
          mime: args.mime,
          size: bytes.length,
          storageKey,
        });
      }),
  );
  return server;
}
