# Atelio

The collaborative filesystem for humans and AI agents.

## What is working

A Next.js 16 / React 19 / strict TypeScript application with a three-column workspace, seeded SHYFT projects, folder navigation, list and grid views, TipTap document editing and autosave, real uploads, image/video/PDF previews, full-text search, comments/replies/reactions/resolution, append-only versions and activity, version restoration, trash, human and agent details, scoped agent creation, one-time credentials, credential rotation/revocation, and an MCP Streamable HTTP endpoint.

All data lives in PostgreSQL. The local demo runs the same SQL on an embedded Postgres ([PGlite](https://pglite.dev)) stored in `data/pglite`, so demo, tests, and production share one code path. The demo is single-process, signs you in as the seeded owner, and is disabled in production builds. On first boot it imports a legacy `data/workspace.json` if one exists, otherwise it seeds the SHYFT workspace.

Sign-in is self-hosted: password accounts, 30-day HttpOnly session cookies, and single-use invitation links that you share by hand (nothing is emailed). Uploads go to local disk, or to S3-compatible storage when a bucket is configured.

## Run locally

Requires Node.js 20.9+ (Node 22 or 24 recommended).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 for the landing page, or http://localhost:3000/workspace for the application. `.env.example` enables demo mode. Demo service tokens are real, scoped, hashed credentials for the local server. Never expose the demo server publicly. `npm run build` verifies production compilation; production uses the cloud backend and ignores the demo flag.

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Connect Claude Code, Codex, or another MCP client

1. Open **AI teammates → Add agent**.
2. Select its name, permissions, and projects. Full workspace access is optional and explicit.
3. Generate and copy the configuration. Tokens are shown once and expire after 90 days.
4. Add the HTTP endpoint and bearer header to your client's MCP configuration:

```json
{
  "mcpServers": {
    "atelio": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_ONE_TIME_TOKEN" }
    }
  }
}
```

Client configuration formats differ; the endpoint uses MCP Streamable HTTP. Connect a local client to a local demo. Use a deployed HTTPS origin for remote agents.

Available tools: `list_workspaces`, `list_projects`, `list_folders`, `list_files`, `search_files`, `get_file`, `read_document`, `create_document`, `update_document`, `create_folder`, `rename_file`, `move_file`, `delete_file`, `restore_file`, `upload_asset`, `create_comment`, `list_comments`, `get_activity`, `get_versions`, `restore_version`, `get_workspace_context`, and `get_project_context`.

`update_document` requires `baseVersion` from a fresh read. Stale writes return a conflict. `upload_asset` accepts base64 assets up to 5 MB; authenticated multipart `/api/assets` accepts up to 100 MB. Tokens cannot select another principal or bypass the service layer. Regenerate revokes old tokens; disconnect revokes every token for that agent.

## Deploy

The app is a Node Next.js server (not a static export or an edge bundle) plus PostgreSQL 15+. No third-party service is required.

1. Provision PostgreSQL and set `DATABASE_URL` (the app sets `search_path` per connection, so use a direct or session-pooled connection).
2. Set `SPACIE_DEMO_MODE=false`, `SPACIE_ORIGIN` (the exact public HTTPS origin), and `SPACIE_DATA_DIR` (where uploads are stored).
3. `npm ci && npm run build`, then run `next start` behind an HTTPS reverse proxy. Pending migrations apply on boot under an advisory lock (`npm run db:migrate` does the same by hand).
4. Create the first workspace: `npm run create-owner -- "Workspace name"` prints a single-use link. Open it to create the owner account.
5. Invite people from **Share → Create invitation link**. Links are single-use, expire after 7 days, and can be locked to an email.
6. Optional object storage: set the `R2_*` variables and `SPACIE_UPLOAD_SECRET`. Allow `PUT`, `GET`, and `HEAD` from your origin in bucket CORS with `Content-Type` and `Content-Length` headers and exposed `ETag`, and expire each workspace's `staging/` prefix after one day.

## Architecture

- `features/workspace/`: working surface, sidebar, TipTap editor, collaboration panel. The client polls `GET /api/workspace?since=<revision>` (a one-row check) and refetches the snapshot only when the revision moved; an open file's body, comments, and versions come from `/api/files`.
- `lib/service/`: validated commands, shared by humans and agents. Each command is one transaction that bumps the workspace revision first; that row lock serializes writes per workspace across server instances, and a failed command rolls back entirely.
- `lib/queries.ts`: targeted reads — metadata snapshot, file detail, version bodies, full-text search, activity — filtered to what the principal can read.
- `lib/permissions.ts`, `lib/access.ts`: deny-by-default agent authorization with workspace → project → folder overrides (the most specific grant wins). Readability depends only on a file's location, so it compiles to a SQL predicate.
- `lib/db/`: `pg` or PGlite behind one small interface, the migration runner, and first-sign-in bootstrap.
- `db/migrations/`: typed relational schema. Composite foreign keys keep records inside their workspace and replies inside their file; triggers make versions, activity, and audit logs append-only.
- `lib/mcp/tools.ts`: MCP tools with specific input schemas, mapped onto the same queries and commands.
- `lib/storage.ts`: private binary storage, short-lived signed downloads, verified direct uploads.

## Validation

`npm run typecheck`, `npm run lint`, `npm test` (27 tests, run against real Postgres via PGlite: permissions, scoping, version history, stale-write conflicts under concurrency, rollback, credential lifecycle, sign-in and invitations, search, schema integrity, and the MCP tools through an in-memory client), and `npm run build`.

## Known limits

- No self-service password reset yet (to be added as a server command).
- Collaboration is optimistic per document, not a character-level CRDT: a conflicting editor gets `CONFLICT` and reloads.
- One workspace per signed-in account.
- Project grants are editable when connecting an agent; folder overrides exist in authorization but have no UI yet.
- Uploads are limited to 100 MB, without multipart/resumable uploads or malware scanning.
- The snapshot lists every readable file's metadata and the latest 100 activity events; very large workspaces will want pagination.
