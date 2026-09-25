# Spacie

The collaborative filesystem for humans and AI agents.

## What is working

A Next.js 16 / React 19 / strict TypeScript application with a three-column workspace, seeded SHYFT projects, folder navigation, list and grid views, TipTap document editing and autosave, real uploads, image/video/PDF previews, full-text search, comments/replies/reactions/resolution, append-only versions and activity, version restoration, trash, human and agent details, scoped agent creation, one-time credentials, credential rotation/revocation, and an MCP Streamable HTTP endpoint.

All data lives in PostgreSQL. The local demo runs the same SQL on an embedded Postgres ([PGlite](https://pglite.dev)) stored in `data/pglite`, so demo, tests, and production share one code path. The demo is single-process, signs you in as the seeded owner, and is disabled in production builds. On first boot it imports a legacy `data/workspace.json` if one exists, otherwise it seeds the SHYFT workspace.

Human sign-in uses Supabase Auth (magic links and invitations); binaries use S3-compatible storage (R2 or Hetzner Object Storage). **Sign-in and object storage have not yet been exercised against live accounts.**

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
    "spacie": {
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

The app is a Node Next.js server (not a static export or an edge bundle) plus PostgreSQL 15+.

1. Provision PostgreSQL: a self-hosted instance (for example on Hetzner) or a Supabase project. Set `DATABASE_URL`. With Supabase, use the direct or session-pooler connection string: the app sets `search_path` per connection, which transaction pooling does not keep. Tables live in the `spacie` schema, which Supabase's REST API does not expose.
2. Run `npm run db:migrate` (the server also applies pending migrations on boot, under an advisory lock).
3. Set `SPACIE_DEMO_MODE=false`, `SPACIE_ORIGIN` (exact HTTPS origin), and `SPACIE_UPLOAD_SECRET` (`openssl rand -base64 48`).
4. Sign-in: create a Supabase project (Auth only is enough), set the three `SUPABASE` variables, set the site URL, and allowlist `/api/auth/callback`. Email sign-in uses PKCE. Invitation templates should use `{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=invite`; magic-link templates the equivalent `type=magiclink`.
5. Storage: create a private bucket and set the `R2_*` variables (any S3-compatible endpoint). Allow `PUT`, `GET`, and `HEAD` from your origin in bucket CORS with `Content-Type` and `Content-Length` headers and exposed `ETag`. Expire objects under each workspace's `staging/` prefix after one day. Uploads are verified and copied to fresh immutable keys before metadata is recorded, so a reused signed PUT URL cannot alter a saved version.
6. `npm ci && npm run build && next start` behind an HTTPS reverse proxy. The bundled start script binds to loopback; set the host's bind address in its launch command.
7. Sign in at `/login`. New accounts get a workspace; invited accounts join the inviting workspace.

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

`npm run typecheck`, `npm run lint`, `npm test` (21 tests, run against real Postgres via PGlite: permissions, scoping, version history, stale-write conflicts under concurrency, rollback, credential lifecycle, search, schema integrity, and the MCP tools through an in-memory client), and `npm run build`.

## Known limits

- Sign-in (Supabase Auth, SMTP) and object storage still need a live integration pass.
- Collaboration is optimistic per document, not a character-level CRDT: a conflicting editor gets `CONFLICT` and reloads.
- One workspace per signed-in account.
- Project grants are editable when connecting an agent; folder overrides exist in authorization but have no UI yet.
- Uploads are limited to 100 MB, without multipart/resumable uploads or malware scanning.
- The snapshot lists every readable file's metadata and the latest 100 activity events; very large workspaces will want pagination.
