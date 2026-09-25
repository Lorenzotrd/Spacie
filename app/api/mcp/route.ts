import { boundedRequest } from "@/lib/http";
import { audit } from "@/lib/audit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { authenticate } from "@/lib/auth";
import { publicState, commandSchema, execute } from "@/lib/service";
import { load, transaction } from "@/lib/repository";
import { touchPresence } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";
import { storeAsset } from "@/lib/storage";
import { requirePermission } from "@/lib/permissions";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!request.headers.get("authorization")?.startsWith("Bearer "))
      return Response.json({ error: "Agent token required" }, { status: 401 });
    const { state, actor } = await authenticate(request);
    if (actor.type !== "agent") throw new Error("UNAUTHORIZED");
    await rateLimit(actor.id);
    await audit(state.workspace.id, actor.id, "mcp_request");
    await touchPresence(state.workspace.id, {
      principalId: actor.id,
      resourceId: null,
      state: "working",
      lastSeenAt: new Date().toISOString(),
    });
    const server = new McpServer({ name: "spacie", version: "0.1.0" });
    const respond = (data: unknown) => ({
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
    });
    const readTools = [
      "list_workspaces",
      "list_projects",
      "list_folders",
      "list_files",
      "search_files",
      "get_file",
      "read_document",
      "list_comments",
      "get_activity",
      "get_versions",
      "get_workspace_context",
      "get_project_context",
    ] as const;
    for (const tool of readTools)
      server.registerTool(
        tool,
        {
          description: `${tool.replaceAll("_", " ")} within your granted access.`,
          inputSchema: {
            id: z.string().uuid().optional(),
            projectId: z.string().uuid().optional(),
            folderId: z.string().uuid().nullable().optional(),
            query: z.string().max(500).optional(),
          },
        },
        async (args) => {
          const visible = publicState(await load(state.workspace.id), actor);
          const files = visible.files.filter(
            (f) =>
              !f.deleted &&
              (!args.projectId || f.projectId === args.projectId) &&
              (args.folderId === undefined || f.folderId === args.folderId),
          );
          switch (tool) {
            case "list_workspaces":
              return respond(
                visible.projects.length ? [visible.workspace] : [],
              );
            case "list_projects":
              return respond(visible.projects);
            case "list_folders":
              return respond(
                visible.folders.filter(
                  (f) => !args.projectId || f.projectId === args.projectId,
                ),
              );
            case "list_files":
              return respond(files);
            case "search_files":
              return respond(
                files.filter((f) =>
                  `${f.name} ${f.content}`
                    .toLowerCase()
                    .includes((args.query ?? "").toLowerCase()),
                ),
              );
            case "get_file":
            case "read_document": {
              const file = files.find((f) => f.id === args.id);
              if (!file)
                return {
                  ...respond({ error: "File not found or access denied" }),
                  isError: true,
                };
              return respond(file);
            }
            case "list_comments":
              return respond(
                visible.comments.filter((c) => c.fileId === args.id),
              );
            case "get_versions":
              return respond(
                visible.versions.filter((v) => v.fileId === args.id),
              );
            case "get_activity":
              return respond(
                visible.activity
                  .filter(
                    (a) => !args.projectId || a.projectId === args.projectId,
                  )
                  .slice(0, 100),
              );
            case "get_project_context":
              return respond({
                project: visible.projects.find((p) => p.id === args.projectId),
                folders: visible.folders.filter(
                  (f) => f.projectId === args.projectId,
                ),
                files,
              });
            default:
              return respond({
                workspace: visible.workspace,
                projects: visible.projects,
                principals: visible.principals,
                files,
              });
          }
        },
      );
    const mutations = [
      "create_document",
      "update_document",
      "create_folder",
      "rename_file",
      "move_file",
      "delete_file",
      "restore_file",
      "create_comment",
      "restore_version",
    ] as const;
    for (const action of mutations)
      server.registerTool(
        action,
        {
          description: `${action.replaceAll("_", " ")}. Document updates require baseVersion from read_document.`,
          inputSchema: commandSchema.omit({ action: true }).shape,
        },
        async (args) => {
          try {
            return respond(
              await transaction(state.workspace.id, (s) =>
                execute(s, actor, commandSchema.parse({ ...args, action })),
              ),
            );
          } catch (e) {
            return {
              ...respond({
                error: e instanceof Error ? e.message : "Action failed",
              }),
              isError: true,
            };
          }
        },
      );
    server.registerTool(
      "upload_asset",
      {
        description:
          "Upload an asset up to 5 MB as base64. Larger assets use multipart POST /api/assets with the same bearer token.",
        inputSchema: {
          projectId: z.string().uuid(),
          folderId: z.string().uuid().nullable().optional(),
          name: z.string().min(1).max(180),
          mime: z.string().max(120),
          base64: z
            .string()
            .max(7_000_000)
            .regex(/^[A-Za-z0-9+/]*={0,2}$/),
        },
      },
      async (args) => {
        try {
          const current = await load(state.workspace.id);
          if (
            !current.projects.some((p) => p.id === args.projectId) ||
            (args.folderId &&
              !current.folders.some(
                (f) => f.id === args.folderId && f.projectId === args.projectId,
              ))
          )
            throw new Error("Invalid destination");
          requirePermission(current, actor, "upload", {
            workspaceId: state.workspace.id,
            projectId: args.projectId,
            folderId: args.folderId,
          });
          const bytes = Buffer.from(args.base64, "base64");
          if (bytes.length > 5 * 1024 * 1024)
            throw new Error(
              "Use the multipart endpoint for files larger than 5 MB.",
            );
          const file = new File([bytes], args.name, { type: args.mime });
          const storageKey = await storeAsset(file, state.workspace.id);
          return respond(
            await transaction(state.workspace.id, (s) =>
              execute(s, actor, {
                action: "upload_asset",
                projectId: args.projectId,
                folderId: args.folderId,
                name: args.name,
                mime: args.mime,
                size: bytes.length,
                storageKey,
              }),
            ),
          );
        } catch (e) {
          return {
            ...respond({
              error: e instanceof Error ? e.message : "Upload failed",
            }),
            isError: true,
          };
        }
      },
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return await transport.handleRequest(
      await boundedRequest(request, 7500000),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function GET() {
  return Response.json(
    { error: "Use MCP Streamable HTTP POST with a bearer token." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
