"use client";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Search,
  Plus,
  Folder,
  ChevronRight,
  Users,
  AudioLines,
  ArrowUpRight,
  SlidersHorizontal,
  List,
  Grid2X2,
  FileText,
  Upload,
  ArrowUp,
  PanelRight,
  Image as ImageIcon,
  Film,
  Command as CommandIcon,
  Link,
  Check,
  ArrowLeft,
  Download,
  Menu,
  X,
} from "lucide-react";
import type { PresenceEntry } from "@/lib/presence";
import type { Action, Principal, FileRecord } from "@/lib/types";
import { WorkspaceDialogs } from "./dialogs";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "./use-workspace";
import { DocumentEditor } from "./editor";
import { Avatar } from "@/components/ui/avatar";
import { AppSidebar } from "./sidebar";
import { ActivityFeed, CollaborationPanel } from "./collaboration";

function FileIcon({ file }: { file: FileRecord }) {
  return (
    <span
      className={`file-icon ${file.mime.includes("image") ? "file-type-4" : file.mime.includes("video") ? "file-type-5" : file.mime.includes("pdf") ? "file-type-3" : "file-type-0"}`}
    >
      {file.mime.includes("image") ? (
        <ImageIcon size={20} />
      ) : file.mime.includes("video") ? (
        <Film size={20} />
      ) : (
        <FileText size={20} />
      )}
    </span>
  );
}
function relative(date: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes} min ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} hours ago`
        : new Date(date).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
          });
}
export default function Workspace() {
  const { state, error, setError, notice, setNotice, mutate, refresh } =
    useWorkspace();
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [project, setProject] = useState(
    "30000000-0000-4000-8000-000000000001",
  );
  const [folder, setFolder] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState("space");
  const [tab, setTab] = useState("All files");
  const [right, setRight] = useState("Comments");
  const [showRight, setShowRight] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [grid, setGrid] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState<Principal | null>(null);
  const [provider, setProvider] = useState("Claude Code");
  const [permissions, setPermissions] = useState<Action[]>([
    "read",
    "write",
    "create",
    "upload",
    "comment",
    "rename",
    "move",
    "create_folder",
  ]);
  const [scope, setScope] = useState<string[]>([project]);
  const [fullAccess, setFullAccess] = useState(false);
  const [token, setToken] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "viewer" | "admin">(
    "member",
  );
  const [moveFolder, setMoveFolder] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [sort, setSort] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
      if (e.key === "Escape") {
        setSelected(null);
        setMobileNav(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const currentPrincipalId = state?.currentPrincipalId;
  useEffect(() => {
    if (!currentPrincipalId) return;
    const ping = () =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: selected,
          state: selected ? "viewing" : "idle",
        }),
      })
        .then((r) => (r.ok ? r.json() : []))
        .then(setPresence)
        .catch(() => undefined);
    void ping();
    const interval = setInterval(ping, 10000);
    return () => clearInterval(interval);
  }, [selected, currentPrincipalId]);
  const file = state?.files.find((f) => f.id === selected);
  const p = state?.projects.find((x) => x.id === project) ?? state?.projects[0];
  useEffect(() => {
    if (
      state &&
      state.projects.length &&
      !state.projects.some((p) => p.id === project)
    )
      setProject(state.projects[0].id);
  }, [state, project]);
  useEffect(() => {
    setAssetUrl("");
    if (file?.storageKey)
      fetch(`/api/assets?id=${file.id}`)
        .then((r) => r.json())
        .then((d) => setAssetUrl(d.url ?? ""))
        .catch(() => undefined);
  }, [file?.id, file?.storageKey]);
  function navigate(projectId: string, folderId: string | null = null) {
    setProject(projectId);
    setFolder(folderId);
    setSelected(null);
    setView("space");
    setQuery("");
    setMobileNav(false);
  }
  function openFile(f: FileRecord) {
    setSelected(f.id);
    setProject(f.projectId);
    setView("space");
    setShowRight(true);
    setRight("Comments");
  }
  function dialog(type: string, value = "") {
    setName(value);
    setModal(type);
  }
  async function submit() {
    setBusy(true);
    try {
      if (modal === "document" || modal === "folder" || modal === "project") {
        const result = await mutate({
          action:
            modal === "document"
              ? "create_document"
              : modal === "folder"
                ? "create_folder"
                : "create_project",
          name,
          projectId: project,
          folderId: folder,
          content: modal === "document" ? "<p></p>" : undefined,
        });
        if (modal === "document" && result.id) setSelected(result.id);
        if (modal === "project" && result.id) navigate(result.id);
        setNotice(`${modal[0].toUpperCase() + modal.slice(1)} created`);
      } else if (modal === "rename" && file)
        await mutate({ action: "rename_file", id: file.id, name });
      else if (modal === "move" && file) {
        await mutate({
          action: "move_file",
          id: file.id,
          projectId: project,
          folderId: moveFolder || null,
        });
        setSelected(null);
      } else if (modal === "delete" && file) {
        await mutate({ action: "delete_file", id: file.id });
        setSelected(null);
        setNotice("Moved to trash");
      } else if (modal === "connect") {
        const result = await mutate({
          action: "connect_agent",
          name: name || provider,
          provider,
          permissions,
          scope,
          fullAccess,
        });
        setToken(result.token ?? "");
        setModal("credentials");
        return;
      } else if (modal === "share") {
        const response = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: replyEmail, role: inviteRole }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setNotice("Invitation sent");
      }
      setModal("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (state?.demo) {
          const form = new FormData();
          form.append("file", f);
          form.append("projectId", project);
          if (folder) form.append("folderId", folder);
          const response = await fetch("/api/assets", {
            method: "POST",
            body: form,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
        } else {
          const prepared = await fetch("/api/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: project,
              folderId: folder,
              name: f.name,
              mime: f.type,
              size: f.size,
            }),
          });
          const info = await prepared.json();
          if (!prepared.ok) throw new Error(info.error);
          const uploaded = await fetch(info.url, {
            method: "PUT",
            headers: { "Content-Type": f.type },
            body: f,
          });
          if (!uploaded.ok)
            throw new Error("Storage upload failed. Please try again.");
          const finished = await fetch("/api/uploads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticket: info.ticket }),
          });
          const result = await finished.json();
          if (!finished.ok) throw new Error(result.error);
        }
      }
      await refresh();
      setNotice("Upload complete");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (upload.current) upload.current.value = "";
    }
  }
  if (!state)
    return (
      <div className="loading-screen">
        <Box size={35} />
        <h1>spacie</h1>
        <p>{error || "Opening your workspace…"}</p>
        {error && <a href="/login">Sign in to your workspace →</a>}
      </div>
    );
  const projectName = p?.name ?? "Workspace";
  const visibleFiles = state.files
    .filter(
      (f) =>
        f.projectId === project &&
        f.folderId === folder &&
        !f.deleted &&
        (tab !== "Documents" || f.mime === "application/x-spacie-doc") &&
        (tab !== "Assets" || f.mime !== "application/x-spacie-doc") &&
        f.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => (sort ? a.name.localeCompare(b.name) : 0));
  const visibleFolders = state.folders.filter(
    (f) =>
      f.projectId === project &&
      f.parentId === folder &&
      f.name.toLowerCase().includes(query.toLowerCase()),
  );
  const results = search.toLowerCase();
  return (
    <div
      className={`app-shell ${!showRight ? "panel-hidden" : ""} ${mobileNav ? "nav-open" : ""}`}
    >
      <AppSidebar
        state={state}
        project={project}
        view={view}
        folder={folder}
        navigate={navigate}
        setView={setView}
        setSelected={setSelected}
        dialog={dialog}
        setAgent={setAgent}
        setMobileNav={setMobileNav}
      />
      <main>
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={18} />
            </button>
            <button
              onClick={() => {
                setView("home");
                setSelected(null);
              }}
            >
              {state.workspace.name}
            </button>
            <ChevronRight size={14} />
            <Box size={15} />
            <button onClick={() => navigate(project)}>{projectName}</button>
            {folder && (
              <>
                <ChevronRight size={14} />
                <button onClick={() => setSelected(null)}>
                  {state.folders.find((f) => f.id === folder)?.name}
                </button>
              </>
            )}
          </div>
          <div>
            <span className="demo-label">
              {state.demo ? "Demo workspace" : ""}
            </span>
            <button
              aria-label="Search everything"
              className="icon-button"
              onClick={() => dialog("search")}
            >
              <Search size={17} />
            </button>
            <button
              aria-label="Toggle collaboration"
              className="icon-button"
              onClick={() => setShowRight(!showRight)}
            >
              <PanelRight size={17} />
            </button>
          </div>
        </header>
        {view === "space" ? (
          file ? (
            <>
              <div className="document-header">
                <button
                  className="back-button"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={15} />
                  Back to {projectName}
                </button>
                <div className="title-line">
                  <FileIcon file={file} />
                  <h1>{file.name}</h1>
                  <div className="heading-actions">
                    <button className="button" onClick={() => dialog("share")}>
                      <Users size={14} />
                      Share
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Download file"
                      onClick={() => {
                        if (assetUrl) {
                          window.open(assetUrl, "_blank", "noopener");
                        } else if (file.mime === "application/x-spacie-doc") {
                          const url = URL.createObjectURL(
                            new Blob([file.content], { type: "text/html" }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = file.name + ".html";
                          a.click();
                          URL.revokeObjectURL(url);
                        } else
                          setError(
                            "This seeded asset has no binary attached. Upload a file to preview it.",
                          );
                      }}
                    >
                      <Download size={17} />
                    </button>
                    <FileMenu
                      items={[
                        {
                          label: "Rename",
                          onSelect: () => dialog("rename", file.name),
                        },
                        {
                          label: "Move to folder",
                          onSelect: () => dialog("move"),
                        },
                        {
                          label: "Move to trash",
                          onSelect: () => dialog("delete"),
                          danger: true,
                        },
                      ]}
                    />
                  </div>
                </div>
                <div className="presence-line">
                  {presence
                    .filter((e) => e.resourceId === file.id)
                    .map((e) => (
                      <span key={e.principalId}>
                        <Avatar
                          small
                          person={state.principals.find(
                            (p) => p.id === e.principalId,
                          )}
                        />
                        {
                          state.principals.find((p) => p.id === e.principalId)
                            ?.name
                        }{" "}
                        is {e.state}
                      </span>
                    ))}
                </div>
                <p>
                  Version {file.version} <span>·</span> Edited by{" "}
                  {state.principals.find((p) => p.id === file.updatedBy)?.name}{" "}
                  <span>·</span> {relative(file.updatedAt)}
                </p>
              </div>
              {file.mime === "application/x-spacie-doc" ? (
                <DocumentEditor
                  key={file.id}
                  content={file.content}
                  onSave={async (content) => {
                    await mutate({
                      action: "update_document",
                      id: file.id,
                      content,
                      baseVersion: file.version,
                    });
                  }}
                />
              ) : assetUrl ? (
                <div className="asset-preview">
                  {file.mime.startsWith("image/") ? (
                    <NextImage
                      src={assetUrl}
                      alt={file.name}
                      width={1400}
                      height={1000}
                      unoptimized
                      style={{
                        objectFit: "contain",
                        width: "100%",
                        height: "auto",
                      }}
                    />
                  ) : file.mime.startsWith("video/") ? (
                    <video src={assetUrl} controls />
                  ) : file.mime === "application/pdf" ? (
                    <iframe title={file.name} src={assetUrl} />
                  ) : (
                    <a className="button" href={assetUrl}>
                      Download {file.name}
                    </a>
                  )}
                </div>
              ) : (
                <div className="empty-state large">
                  <FileIcon file={file} />
                  <h2>{file.name}</h2>
                  <p>This demo entry has no binary attached.</p>
                  <p>
                    Upload your own images, videos, or PDFs to preview them
                    here.
                  </p>
                  <button
                    className="button"
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={15} />
                    Upload an asset
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="main-heading">
                <div className="project-cover">
                  <Box size={26} />
                </div>
                <div className="title-line">
                  <h1>
                    {folder
                      ? state.folders.find((f) => f.id === folder)?.name
                      : projectName}
                  </h1>
                  <div className="heading-actions">
                    <div className="avatar-stack">
                      {state.principals.slice(0, 4).map((x) => (
                        <button
                          key={x.id}
                          onClick={() => {
                            setAgent(x);
                            dialog(x.type === "agent" ? "agent" : "person");
                          }}
                        >
                          <Avatar person={x} small />
                        </button>
                      ))}
                    </div>
                    <button className="button" onClick={() => dialog("share")}>
                      <Users size={15} />
                      Share
                    </button>
                  </div>
                </div>
                <p>{p?.description}</p>
              </div>
              <div className="content-tabs">
                {["All files", "Documents", "Assets", "Activity"].map((t) => (
                  <button
                    className={t === tab ? "active" : ""}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                    {t === "All files" && (
                      <span>
                        {state.files.filter(
                          (f) => f.projectId === project && !f.deleted,
                        ).length +
                          state.folders.filter((f) => f.projectId === project)
                            .length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="file-content">
                {tab === "Activity" ? (
                  <ActivityFeed state={state} projectId={project} />
                ) : (
                  <>
                    <div className="toolbar">
                      <div>
                        <Search size={16} />
                        <input
                          aria-label="Find in this space"
                          placeholder="Find in this space…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Sort by name"
                        onClick={() => setSort(!sort)}
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                      <span className="divider" />
                      <button
                        className={`icon-button ${!grid ? "active" : ""}`}
                        aria-label="List view"
                        onClick={() => setGrid(false)}
                      >
                        <List size={17} />
                      </button>
                      <button
                        className={`icon-button ${grid ? "active" : ""}`}
                        aria-label="Grid view"
                        onClick={() => setGrid(true)}
                      >
                        <Grid2X2 size={16} />
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => upload.current?.click()}
                      >
                        <Upload size={15} />
                        {busy ? "Uploading…" : "Upload"}
                      </button>
                      <button
                        className="button primary"
                        onClick={() => dialog("new")}
                      >
                        <Plus size={16} />
                        New
                      </button>
                    </div>
                    <div className={grid ? "file-grid" : "file-table"}>
                      {!grid && (
                        <div className="table-head">
                          <span>
                            Name <ArrowUp size={12} />
                          </span>
                          <span>Last modified</span>
                          <span>Modified by</span>
                          <span />
                        </div>
                      )}
                      {tab === "All files" &&
                        visibleFolders.map((f) => (
                          <button
                            className="file-row folder-row"
                            key={f.id}
                            onClick={() => navigate(project, f.id)}
                          >
                            <span>
                              <span className="file-icon folder-icon">
                                <Folder size={21} />
                              </span>
                              <strong>{f.name}</strong>
                            </span>
                            <span>—</span>
                            <span className="muted">—</span>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                      {visibleFiles.map((f) => (
                        <div className="file-row" key={f.id}>
                          <button
                            className="file-open"
                            onClick={() => openFile(f)}
                          >
                            <FileIcon file={f} />
                            <strong>{f.name}</strong>
                            {f.version > 1 && (
                              <span className="file-tag">
                                {f.version} versions
                              </span>
                            )}
                          </button>
                          <span>{relative(f.updatedAt)}</span>
                          <span>
                            <Avatar
                              small
                              person={state.principals.find(
                                (x) => x.id === f.updatedBy,
                              )}
                            />
                            {
                              state.principals.find((x) => x.id === f.updatedBy)
                                ?.name
                            }
                          </span>
                          <FileMenu
                            items={[
                              { label: "Open", onSelect: () => openFile(f) },
                              {
                                label: "Rename",
                                onSelect: () => {
                                  setSelected(f.id);
                                  dialog("rename", f.name);
                                },
                              },
                              {
                                label: "Move to trash",
                                onSelect: () => {
                                  setSelected(f.id);
                                  dialog("delete");
                                },
                                danger: true,
                              },
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                    {!visibleFiles.length &&
                      (!visibleFolders.length || tab !== "All files") && (
                        <div className="empty-state">
                          <Folder size={32} />
                          <h2>
                            {query
                              ? "Nothing matches your search"
                              : "Room for your next idea."}
                          </h2>
                          <p>
                            {query
                              ? "Try a different filename."
                              : "Create a document or upload something to get started."}
                          </p>
                          <button
                            className="button primary"
                            onClick={() => dialog("document")}
                          >
                            Create a document
                          </button>
                        </div>
                      )}
                    <div className="file-footer">
                      <span>
                        {visibleFiles.length +
                          (tab === "All files"
                            ? visibleFolders.length
                            : 0)}{" "}
                        items
                      </span>
                      <span>
                        <Link size={12} /> A shared space for good work.
                      </span>
                    </div>
                    <div className="quiet-note">
                      <span>
                        <AudioLines size={17} />
                      </span>
                      <div>
                        <strong>Great work has good company.</strong>
                        <p>
                          Your team and AI teammates, working from the same
                          page.
                        </p>
                      </div>
                      <button
                        aria-label="See AI teammates"
                        onClick={() => setView("agents")}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )
        ) : (
          <div className="secondary-page">
            <div className="title-line">
              <h1>
                {view === "agents"
                  ? "AI teammates"
                  : view === "home"
                    ? `Welcome back, ${state.principals.find((p) => p.id === state.currentPrincipalId)?.name ?? "teammate"}`
                    : view === "trash"
                      ? "Trash"
                      : "Notifications"}
              </h1>
              {view === "agents" && (
                <button
                  className="button primary"
                  onClick={() => dialog("connect")}
                >
                  <Plus size={16} />
                  Add agent
                </button>
              )}
            </div>
            <p className="page-description">
              {view === "agents"
                ? "A little more possibility. Give AI teammates controlled access to your shared work."
                : view === "home"
                  ? "Pick up where you left off."
                  : view === "trash"
                    ? "Deleted files can be restored with their history intact."
                    : "Recent comments and changes across your workspace."}
            </p>
            {view === "agents" ? (
              <div className="agent-cards">
                {state.principals
                  .filter((p) => p.type === "agent")
                  .map((a) => (
                    <button
                      className="agent-card"
                      key={a.id}
                      onClick={() => {
                        setAgent(a);
                        dialog("agent");
                      }}
                    >
                      <Avatar person={a} />
                      <div>
                        <h2>{a.name}</h2>
                        <p>{a.provider}</p>
                      </div>
                      <span>
                        {a.status === "offline" ? "Disconnected" : "Idle"}
                      </span>
                      <p>
                        {state.grants
                          .filter((g) => g.principalId === a.id)
                          .map((g) =>
                            g.fullAccess
                              ? "Full workspace access"
                              : state.projects.find(
                                  (p) => p.id === g.resourceId,
                                )?.name,
                          )
                          .join(", ")}
                      </p>
                    </button>
                  ))}
              </div>
            ) : view === "home" ? (
              <>
                <h2>Recent spaces</h2>
                <div className="recent-spaces">
                  {state.projects.slice(0, 3).map((p) => (
                    <button key={p.id} onClick={() => navigate(p.id)}>
                      <Box style={{ color: p.color }} />
                      <strong>{p.name}</strong>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
                <h2>Continue working</h2>
                {state.files
                  .filter((f) => !f.deleted)
                  .slice(0, 4)
                  .map((f) => (
                    <button
                      className="home-file"
                      key={f.id}
                      onClick={() => openFile(f)}
                    >
                      <FileIcon file={f} />
                      {f.name}
                      <span>{relative(f.updatedAt)}</span>
                    </button>
                  ))}
                <h2>Recent activity</h2>
                <ActivityFeed state={state} />
              </>
            ) : view === "trash" ? (
              <>
                {state.files
                  .filter((f) => f.deleted)
                  .map((f) => (
                    <div className="home-file" key={f.id}>
                      <FileIcon file={f} />
                      {f.name}
                      <button
                        className="button"
                        onClick={() =>
                          void mutate({
                            action: "restore_file",
                            id: f.id,
                          }).catch(() => undefined)
                        }
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                {!state.files.some((f) => f.deleted) && (
                  <div className="empty-state">Nothing in the trash.</div>
                )}
              </>
            ) : (
              <ActivityFeed
                state={{
                  ...state,
                  activity: state.activity.filter(
                    (a) =>
                      a.actorId !== state.currentPrincipalId &&
                      (a.action === "commented on" ||
                        state.principals.some(
                          (p) => p.id === a.actorId && p.type === "agent",
                        )),
                  ),
                }}
              />
            )}
          </div>
        )}
        <footer className="main-footer">
          <span>
            <Check size={13} />
            {state.demo
              ? "Local demo · changes saved on this computer"
              : "Workspace connected"}
          </span>
          <span>
            <CommandIcon size={12} /> K to find anything
          </span>
        </footer>
      </main>
      {showRight && (
        <CollaborationPanel
          state={state}
          file={file}
          projectId={project}
          tab={right}
          setTab={setRight}
          mutate={mutate}
          onClose={() => setShowRight(false)}
        />
      )}
      <input
        ref={upload}
        type="file"
        multiple
        hidden
        onChange={(e) => void uploadFiles(e.target.files)}
      />
      <WorkspaceDialogs
        {...{
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
        }}
      />
      {error && (
        <div role="alert" className="toast error">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}
