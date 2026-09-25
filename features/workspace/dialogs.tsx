"use client";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { FileText, Folder, Upload, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import type { PublicState, FileMeta, Principal, Action } from "@/lib/types";
import { actions } from "@/lib/types";
import type { Command } from "@/lib/service";
type DialogProps = {
  state: PublicState;
  file: FileMeta | undefined;
  agent: Principal | null;
  busy: boolean;
  submit: () => Promise<void>;
  dialog: (type: string, value?: string) => void;
  upload: RefObject<HTMLInputElement | null>;
  openFile: (file: FileMeta) => void;
  /** Server-side matches on names, document text and comments. */
  fileResults: FileMeta[];
  navigate: (projectId: string, folderId?: string | null) => void;
  mutate: (
    command: Command,
  ) => Promise<{ id?: string; token?: string; version?: number }>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
  project: string;
  projectName: string;
  modal: string;
  setModal: Dispatch<SetStateAction<string>>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  provider: string;
  setProvider: Dispatch<SetStateAction<string>>;
  permissions: Action[];
  setPermissions: Dispatch<SetStateAction<Action[]>>;
  scope: string[];
  setScope: Dispatch<SetStateAction<string[]>>;
  fullAccess: boolean;
  setFullAccess: Dispatch<SetStateAction<boolean>>;
  token: string;
  setToken: Dispatch<SetStateAction<string>>;
  replyEmail: string;
  setReplyEmail: Dispatch<SetStateAction<string>>;
  inviteRole: "member" | "viewer" | "admin";
  setInviteRole: Dispatch<SetStateAction<"member" | "viewer" | "admin">>;
  moveFolder: string;
  setMoveFolder: Dispatch<SetStateAction<string>>;
  setAgent: Dispatch<SetStateAction<Principal | null>>;
  results: string;
};
export function WorkspaceDialogs({
  state,
  file,
  agent,
  busy,
  submit,
  dialog,
  upload,
  openFile,
  navigate,
  mutate,
  setNotice,
  setError,
  project,
  projectName,
  modal,
  setModal,
  name,
  setName,
  search,
  setSearch,
  provider,
  setProvider,
  permissions,
  setPermissions,
  scope,
  setScope,
  fullAccess,
  setFullAccess,
  token,
  setToken,
  replyEmail,
  setReplyEmail,
  inviteRole,
  setInviteRole,
  moveFolder,
  setMoveFolder,
  setAgent,
  results,
  fileResults,
}: DialogProps) {
  return (
    <Dialog
      open={!!modal}
      onOpenChange={(open) => {
        if (!open) {
          setModal("");
          setToken("");
        }
      }}
      title={
        (
          {
            new: "Make room for an idea",
            document: "New document",
            folder: "New folder",
            project: "New project",
            search: "Find anything",
            rename: "Rename file",
            move: "Move file",
            delete: "Move to trash?",
            connect: "Connect an AI teammate",
            credentials: "Your agent is ready",
            agent: agent?.name ?? "AI teammate",
            person: agent?.name ?? "Teammate",
            share: "Invite your team",
            workspace: "Your workspace",
          } as Record<string, string>
        )[modal] ?? "Spacie"
      }
      description={
        modal === "connect"
          ? "Choose what your AI teammate can do, and where."
          : modal === "credentials"
            ? "Copy this token now. It will never be shown again."
            : modal === "share"
              ? "Invite a human teammate to this workspace."
              : modal === "search"
                ? "Files, document content, comments, spaces, and teammates."
                : "One shared space. Everything in context."
      }
    >
      {modal === "new" ? (
        <div className="new-options">
          <button onClick={() => dialog("document")}>
            <FileText />
            Document<span>A place to think together</span>
          </button>
          <button onClick={() => dialog("folder")}>
            <Folder />
            Folder<span>A little more room</span>
          </button>
          <button
            onClick={() => {
              setModal("");
              upload.current?.click();
            }}
          >
            <Upload />
            Upload asset<span>Bring your work with you</span>
          </button>
        </div>
      ) : ["document", "folder", "project", "rename"].includes(modal) ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="field-label">
            Name
            <input
              autoFocus
              required
              maxLength={180}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                modal === "document" ? "Untitled document" : "Give it a name"
              }
            />
          </label>
          <button
            disabled={busy || !name.trim()}
            className="button primary modal-submit"
          >
            {modal === "rename" ? "Save name" : "Create " + modal}
          </button>
        </form>
      ) : modal === "search" ? (
        <>
          <input
            className="search-input"
            autoFocus
            placeholder="Search files, projects, people or AI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="search-results">
            {[
              [
                "Files",
                fileResults.map((f) => ({
                    id: f.id,
                    name: f.name,
                    select: () => openFile(f),
                  })),
              ],
              [
                "Folders",
                state.folders
                  .filter((f) => f.name.toLowerCase().includes(results))
                  .map((f) => ({
                    id: f.id,
                    name: f.name,
                    select: () => navigate(f.projectId, f.id),
                  })),
              ],
              [
                "Projects",
                state.projects
                  .filter((p) => p.name.toLowerCase().includes(results))
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    select: () => navigate(p.id),
                  })),
              ],
              [
                "Teammates",
                state.principals
                  .filter((p) => p.name.toLowerCase().includes(results))
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    select: () => {
                      setAgent(p);
                      setTimeout(
                        () => dialog(p.type === "agent" ? "agent" : "person"),
                        0,
                      );
                    },
                  })),
              ],
            ].map(([label, items]) => (
              <div key={label as string}>
                <h3>{label as string}</h3>
                {(items as { id: string; name: string; select: () => void }[])
                  .slice(0, 10)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        item.select();
                        setModal("");
                      }}
                    >
                      {item.name}
                      <ChevronRight size={14} />
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </>
      ) : modal === "connect" ? (
        <>
          <div className="provider-options">
            {[
              "Claude Code",
              "Codex",
              "OpenClaw",
              "Cursor",
              "Custom MCP Client",
            ].map((p) => (
              <button
                className={p === provider ? "chosen" : ""}
                key={p}
                onClick={() => {
                  setProvider(p);
                  setName(p);
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="field-label">
            Agent name
            <input
              value={name || provider}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field-label">
            Access level
            <select
              value={
                fullAccess
                  ? "full"
                  : permissions.includes("write")
                    ? "write"
                    : permissions.includes("comment")
                      ? "comment"
                      : "read"
              }
              onChange={(e) => {
                setFullAccess(e.target.value === "full");
                setPermissions(
                  e.target.value === "read"
                    ? ["read"]
                    : e.target.value === "comment"
                      ? ["read", "comment"]
                      : [
                          "read",
                          "write",
                          "create",
                          "upload",
                          "comment",
                          "rename",
                          "move",
                          "create_folder",
                        ],
                );
              }}
            >
              <option value="read">Read only</option>
              <option value="comment">Read + comment</option>
              <option value="write">Read + write</option>
              <option value="full">Full workspace access</option>
            </select>
          </label>
          {fullAccess ? (
            <p className="warning">
              This agent can read, create, modify, move and delete content
              across this workspace.
            </p>
          ) : (
            <fieldset>
              <legend>Selected projects</legend>
              {state.projects.map((p) => (
                <label className="check-label" key={p.id}>
                  <input
                    type="checkbox"
                    checked={scope.includes(p.id)}
                    onChange={(e) =>
                      setScope(
                        e.target.checked
                          ? [...scope, p.id]
                          : scope.filter((x) => x !== p.id),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
            </fieldset>
          )}
          <details className="advanced-permissions">
            <summary>Advanced permissions</summary>
            {actions.map((a) => (
              <label className="check-label" key={a}>
                <input
                  type="checkbox"
                  disabled={fullAccess}
                  checked={fullAccess || permissions.includes(a)}
                  onChange={(e) =>
                    setPermissions(
                      e.target.checked
                        ? [...permissions, a]
                        : permissions.filter((x) => x !== a),
                    )
                  }
                />
                {a.replaceAll("_", " ")}
              </label>
            ))}
          </details>
          <button
            className="button primary modal-submit"
            disabled={busy || (!fullAccess && !scope.length)}
            onClick={() => void submit()}
          >
            Generate credentials
          </button>
        </>
      ) : modal === "credentials" ? (
        <>
          <label className="field-label">
            Service token
            <input readOnly value={token} />
          </label>
          <p className="subtle-copy">
            Expires in 90 days. Store it in your client’s secret configuration.
          </p>
          <pre className="config-preview">
            {JSON.stringify(
              {
                mcpServers: {
                  spacie: {
                    url:
                      typeof window !== "undefined"
                        ? window.location.origin + "/api/mcp"
                        : "/api/mcp",
                    headers: { Authorization: "Bearer " + token },
                  },
                },
              },
              null,
              2,
            )}
          </pre>
          <button
            className="button primary"
            onClick={() => {
              navigator.clipboard
                .writeText(
                  JSON.stringify(
                    {
                      mcpServers: {
                        spacie: {
                          url: window.location.origin + "/api/mcp",
                          headers: { Authorization: "Bearer " + token },
                        },
                      },
                    },
                    null,
                    2,
                  ),
                )
                .then(() => setNotice("Configuration copied"))
                .catch(() =>
                  setError("Select and copy the configuration manually."),
                );
            }}
          >
            Copy configuration
          </button>
        </>
      ) : modal === "agent" && agent ? (
        <>
          <div className="agent-detail">
            <Avatar person={agent} />
            <div>
              <strong>{agent.provider}</strong>
              <p>
                {agent.status === "offline"
                  ? "Disconnected"
                  : "Idle · waiting for a request"}
              </p>
            </div>
          </div>
          <dl>
            <dt>Access</dt>
            <dd>
              {state.grants
                .filter((g) => g.principalId === agent.id)
                .map((g) =>
                  g.fullAccess
                    ? "Full workspace"
                    : state.projects.find((p) => p.id === g.resourceId)?.name,
                )
                .join(", ") || "No access"}
            </dd>
            <dt>Permissions</dt>
            <dd>
              {Array.from(
                new Set(
                  state.grants
                    .filter((g) => g.principalId === agent.id)
                    .flatMap((g) => g.allow),
                ),
              ).join(", ")}
            </dd>
            <dt>Last action</dt>
            <dd>
              {state.activity.find((a) => a.actorId === agent.id)?.action}{" "}
              {state.activity.find((a) => a.actorId === agent.id)?.name ||
                "No activity yet"}
            </dd>
          </dl>
          <div className="dialog-actions">
            <button
              className="button"
              onClick={async () => {
                try {
                  const result = await mutate({
                    action: "rotate_token",
                    id: agent.id,
                  });
                  setToken(result.token ?? "");
                  setModal("credentials");
                } catch {}
              }}
            >
              Regenerate token
            </button>
            <button
              className="button danger"
              onClick={async () => {
                try {
                  await mutate({ action: "disconnect_agent", id: agent.id });
                  setModal("");
                  setNotice("Agent disconnected");
                } catch {}
              }}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : modal === "person" && agent ? (
        <>
          <div className="agent-detail">
            <Avatar person={agent} />
            <div>
              <strong>{agent.name}</strong>
              <p>
                {agent.role} · {state.workspace.name}
              </p>
            </div>
          </div>
          <p className="subtle-copy">
            {agent.id === state.currentPrincipalId
              ? "You are signed into this workspace."
              : "A member of this shared workspace."}
          </p>
        </>
      ) : modal === "share" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {state.demo && (
            <p className="warning">
              Email invitations need a connected Supabase workspace. This local
              demo does not send email.
            </p>
          )}
          <label className="field-label">
            Email address
            <input
              type="email"
              required
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          </label>
          <label className="field-label">
            Role
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as typeof inviteRole)
              }
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            className="button primary modal-submit"
            disabled={busy || state.demo}
          >
            Send invitation
          </button>
        </form>
      ) : modal === "workspace" ? (
        <>
          <dl>
            <dt>Workspace</dt>
            <dd>{state.workspace.name}</dd>
            <dt>Members</dt>
            <dd>
              {state.principals.filter((p) => p.type === "human").length} humans
              · {state.principals.filter((p) => p.type === "agent").length}{" "}
              agents
            </dd>
            <dt>Connection</dt>
            <dd>
              {state.demo
                ? "Local demo. Data persists on this computer."
                : "Supabase connected"}
            </dd>
          </dl>
          <p className="subtle-copy">
            {state.demo
              ? "Demo identities and earlier activity are seeded examples. Connect Supabase and R2 to use live authentication, invitations, and cloud storage."
              : "Files and agents share the same permission model."}
          </p>
        </>
      ) : modal === "delete" ? (
        <>
          <p className="subtle-copy">
            {file?.name} will move to trash. Its versions and comments will be
            retained.
          </p>
          <button
            className="button danger modal-submit"
            disabled={busy}
            onClick={() => void submit()}
          >
            Move to trash
          </button>
        </>
      ) : modal === "move" ? (
        <>
          <label className="field-label">
            Destination folder
            <select
              value={moveFolder}
              onChange={(e) => setMoveFolder(e.target.value)}
            >
              <option value="">{projectName} (root)</option>
              {state.folders
                .filter((f) => f.projectId === project)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button primary modal-submit"
            onClick={() => void submit()}
          >
            Move file
          </button>
        </>
      ) : null}
    </Dialog>
  );
}
