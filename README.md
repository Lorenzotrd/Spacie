# Spacie

The collaborative filesystem for humans and AI agents.

## What is working

A Next.js 16 / React 19 / strict TypeScript application with a three-column workspace, seeded SHYFT projects, folder navigation, list and grid views, TipTap document editing and autosave, real local uploads, image/video/PDF previews, global search, comments/replies/reactions/resolution, append-only versions and activity, version restoration, trash, human and agent details, scoped agent creation, one-time credentials, credential rotation/revocation, and an MCP Streamable HTTP endpoint.

The local demo is functional and persists metadata and binaries in `data/`. It is explicitly single-process, uses a seeded owner, and is disabled in production. Seeded binary entries have no fabricated assets: the interface labels them; uploaded files have actual previews. Presence is based on recent heartbeats, not simulated coworkers. Shared changes refresh every four seconds locally.

Cloud adapters are implemented for Supabase Auth, PostgreSQL, Realtime, invitations, R2 signed downloads, and direct browser uploads. **These adapters and the SQL migration have not been exercised against live Supabase/R2 accounts. Cloud deployment is pending configuration and integration testing.** This is a working first milestone plus backend/MCP implementation, not a claim of production certification.

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

## Configure the cloud backend

1. Create a Supabase project. Apply `supabase/migrations/202609240001_spacie.sql` through the Supabase CLI or SQL editor.
2. Set the variables in `.env.example`; set `SPACIE_DEMO_MODE=false`. The service-role and R2 secrets are server-only. Set `SPACIE_ORIGIN` to the exact HTTPS application origin.
3. Configure Supabase Auth's site URL and allowlist `/api/auth/callback`. Email sign-in uses PKCE. Invitation email templates should use `{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=invite`; magic-link templates can use the equivalent `type=magiclink` callback. Verify invitation delivery with your SMTP provider.
4. Create a private R2 bucket. Supply its S3 endpoint, bucket, access key, and secret key. Configure bucket CORS to allow `PUT`, `GET`, and `HEAD` from your application origin with `Content-Type` and `Content-Length` headers and exposed `ETag`.
5. Add an R2 lifecycle rule to expire objects under the per-workspace `staging/` prefix after one day. Uploaded objects are verified and copied to fresh immutable keys before recording metadata. This prevents reuse of signed PUT URLs from altering saved versions. Clean up unreferenced finalized objects after an operational retention period; object storage and PostgreSQL cannot commit atomically.
6. Enable Supabase Realtime for `workspaces` (included in migration). Clients subscribe only to revision changes and refetch through authorized routes. They never subscribe to unfiltered file/activity payloads.
7. Deploy to a Node-compatible Next.js host, with secrets set in that host. Run `npm ci`, `npm run build`, and `next start` behind HTTPS with a trusted reverse proxy. The bundled start script binds to loopback for local use; configure the host's expected bind address in its launch command.
8. Sign in at `/login`. New accounts receive a workspace; invited accounts join the invited workspace. Create projects and folders, then connect an agent.

The app is a Node Next.js server; it is not a static export or a Cloudflare Worker bundle. No cloud deployment has been created.

## Architecture

- `features/workspace/`: working surface, sidebar, TipTap editor, collaboration panel, data synchronization.
- `components/ui/`: accessible Radix/shadcn-style dialog/menu primitives and shared avatars.
- `lib/service.ts`: validated domain commands; common paths for human and agent mutations.
- `lib/permissions.ts`: deny-by-default agent authorization and workspace → project → folder overrides. Specific scopes replace inherited grants. Human owner/admin roles grant workspace administration.
- `lib/auth.ts`: verified Supabase sessions and SHA-256 agent-token authentication.
- `lib/repository.ts`: local atomic file writes or PostgreSQL RPCs; optimistic revision conflicts prevent silent lost updates across server instances.
- `lib/storage.ts`: private binary storage, short-lived signed downloads, and verified upload handling.
- `app/api/mcp/`: official MCP SDK, authenticated Streamable HTTP transport, shared service calls.
- `supabase/migrations/`: RLS isolation, immutable version/activity/audit triggers, durable rate limits, membership/bootstrap functions.

Postgres stores domain entities in separate tables with JSONB payloads and indexed/generated relational keys. The JSONB representation mirrors the typed domain model and keeps the MVP repository small. Writes use a workspace-level optimistic transaction. This is intentionally suited to modest workspaces; evolve to per-resource SQL transactions and paginated queries before large workspaces. Supabase owns authentication sessions; the app does not duplicate that session store.

## Validation performed

- TypeScript, ESLint, and production build.
- Seven domain tests: cross-workspace/project denial, folder override precedence, immutable version restoration, stale-edit conflicts, credential hashing/rotation/revocation, comment thread ownership, and read-only restrictions.
- Browser flow: create document, edit/autosave, comment, restore version, grid/list, global search, actual upload, reload persistence, mobile overflow check, no browser exceptions.
- Real HTTP MCP flow: bearer authentication, scoped listing, denied cross-project mutation, agent document create/edit/comment/upload, version and activity attribution, and revoked-token denial.

## Remaining scope and practical limits

- Live Supabase migration, Auth/SMTP, Realtime and R2 integration tests and deployment are still required.
- This is optimistic document collaboration, not a character-level CRDT. A conflicting editor keeps unsaved text and reports failure; refresh after preserving those changes.
- One workspace per signed-in account is selected for now. The switcher is a workspace details surface. Invitations grant workspace membership; external file/folder links and resource-specific invite flows are not implemented.
- Project-scoped grants are editable during connection. Folder overrides exist in the authorization engine but do not yet have a dedicated settings UI.
- Version restoration and metadata/text preview work. Binary replacement uploads, side-by-side rich-text diffing, @mention autocomplete/delivery, and persisted notification read state are not implemented.
- Upload limit is 100 MB. Multipart/resumable object uploads are not implemented; files above that limit are rejected.
- The UI polls for presence and fallback changes. A workspace revision channel speeds updates with Supabase configured. No cursor broadcasting or fictitious “AI editing” animation.
- Local rate limiting is process-local. Cloud mode uses a PostgreSQL rate counter. Malware scanning, content indexing at scale, organization SSO and operational backup/retention need deployment-specific work.
- No billing, CRM, task boards, analytics dashboard, or unrelated product areas.
