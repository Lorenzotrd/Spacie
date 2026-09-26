import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../lib/mcp/tools";
import { ids } from "../lib/seed";
import type { Db } from "../lib/db/client";
import { principal, seededDb } from "./helpers";

const strategy = "40000000-0000-4000-8000-000000000020";
const owlagent = "30000000-0000-4000-8000-000000000002";

async function connect(db: Db, agentId: string) {
  const server = buildServer(db, await principal(db, agentId));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = (await client.callTool({ name, arguments: args })) as {
      content: { text: string }[];
      isError?: boolean;
    };
    return { data: JSON.parse(result.content[0].text), isError: !!result.isError };
  };
  return { client, call };
}

test("MCP exposes documented tools with specific inputs", async () => {
  const { client } = await connect(await seededDb(), ids.claude);
  const { tools } = await client.listTools();
  const update = tools.find((t) => t.name === "update_document")!;
  assert.deepEqual(Object.keys(update.inputSchema.properties ?? {}).sort(), ["baseVersion", "content", "id"]);
  assert.match(update.description ?? "", /baseVersion/);
  assert.ok(tools.some((t) => t.name === "upload_asset"));
  const download = tools.find((t) => t.name === "create_download_link")!;
  assert.deepEqual(Object.keys(download.inputSchema.properties ?? {}).sort(), ["id", "preview", "version"]);
});

test("an agent reads, edits with baseVersion, and gets CONFLICT on stale writes", async () => {
  const { call } = await connect(await seededDb(), ids.claude);
  const files = await call("list_files", { projectId: ids.rebond, folderId: null });
  assert.ok(files.data.some((f: { id: string }) => f.id === strategy));
  assert.equal("content" in files.data[0], false);
  const doc = await call("read_document", { id: strategy });
  assert.equal(doc.data.version, 4);
  const saved = await call("update_document", { id: strategy, content: "<p>v5</p>", baseVersion: doc.data.version });
  assert.deepEqual(saved, { data: { id: strategy, version: 5 }, isError: false });
  const stale = await call("update_document", { id: strategy, content: "<p>old</p>", baseVersion: 4 });
  assert.equal(stale.isError, true);
  assert.match(stale.data.error, /CONFLICT/);
});

test("an agent cannot see or write outside its grants through MCP", async () => {
  const db = await seededDb();
  const { call } = await connect(db, ids.claude);
  const projects = await call("list_projects");
  assert.deepEqual(projects.data.map((p: { id: string }) => p.id), [ids.rebond]);
  const denied = await call("create_document", { projectId: owlagent, name: "intrusion" });
  assert.equal(denied.isError, true);
  assert.match(denied.data.error, /FORBIDDEN/);
  const missing = await call("read_document", { id: "40000000-0000-4000-8000-000000009999" });
  assert.equal(missing.isError, true);
});
