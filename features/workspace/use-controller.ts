"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PresenceEntry } from "@/lib/presence";
import type { Action, FileMeta, Principal } from "@/lib/types";
import { copyText } from "@/components/ui/code-block";
import { useWorkspace } from "./use-workspace";
import { useFileDetail, useFileSearch } from "./use-file-detail";
import { useDeepLink, type Place } from "./use-deep-link";
import { uploadNotice, uploadOne } from "./upload";
import type { FileSort, FileTab } from "./derive";
import type { ShareTargetRef } from "./share-panel";

export type View = "space" | "home" | "activity" | "trash" | "projects" | "me";
export type RailTab = "activity" | "comments" | "versions";
export type InviteRole = "member" | "viewer" | "admin";

const DEFAULT_AGENT_PERMISSIONS: Action[] = [
  "read", "write", "create", "upload", "comment", "rename", "move", "create_folder",
];
const PRESENCE_MS = 10_000;

/** All workspace UI state and actions, shared by the desktop and mobile layouts. */
export function useController() {
  const ws = useWorkspace();
  const { state, setError, setNotice, mutate, refresh } = ws;
  const [place, setPlace] = useState<Place>({ project: "", folder: null, selected: null });
  const { project, folder, selected } = place;
  const [view, setView] = useState<View>("space");
  const [tab, setTab] = useState<FileTab>("all");
  const [sort, setSort] = useState<FileSort>("recent");
  const [grid, setGrid] = useState(false);
  const [rail, setRail] = useState<RailTab>("activity");
  const [showRail, setShowRail] = useState(true);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  // Dialog state, kept here because the shared dialogs read and write it.
  const [modal, setModal] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState<Principal | null>(null);
  const [provider, setProvider] = useState("Claude Code");
  const [permissions, setPermissions] = useState<Action[]>(DEFAULT_AGENT_PERMISSIONS);
  const [scope, setScope] = useState<string[]>([]);
  const [fullAccess, setFullAccess] = useState(false);
  const [token, setToken] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [moveFolder, setMoveFolder] = useState("");
  const [shareFile, setShareFile] = useState<FileMeta | null>(null);
  const [compare, setCompare] = useState<{ fileId: string; version?: number } | null>(null);
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modal !== "share") setShareFile(null);
  }, [modal]);
  // Fall back to the first project when none (or an inaccessible one) is selected.
  useEffect(() => {
    if (state?.projects.length && !state.projects.some((p) => p.id === project))
      setPlace((p) => ({ ...p, project: state.projects[0].id, folder: null }));
  }, [state, project]);
  useDeepLink(state, place, (next) => {
    setPlace(next);
    setView("space");
  });

  const file = state?.files.find((f) => f.id === selected);
  const { detail, detailError, retryDetail, loadVersion } = useFileDetail(file ? file.id : null, state?.revision);
  const fileResults = useFileSearch<FileMeta>(search);

  const currentPrincipalId = state?.currentPrincipalId;
  useEffect(() => {
    if (!currentPrincipalId) return;
    const ping = () =>
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: selected, state: selected ? "viewing" : "idle" }),
      })
        .then((r) => (r.ok ? r.json() : []))
        .then(setPresence)
        .catch(() => undefined);
    void ping();
    const interval = setInterval(ping, PRESENCE_MS);
    return () => clearInterval(interval);
  }, [selected, currentPrincipalId]);

  const navigate = useCallback((projectId: string, folderId: string | null = null) => {
    setPlace({ project: projectId, folder: folderId, selected: null });
    setView("space");
  }, []);
  const openFile = useCallback((f: FileMeta) => {
    setPlace({ project: f.projectId, folder: f.folderId, selected: f.id });
    setView("space");
    setShowRail(true);
    setRail("comments");
  }, []);
  /** After switching workspace: reload everything and start from its first project. */
  const reloadWorkspace = useCallback(async () => {
    setPlace({ project: "", folder: null, selected: null });
    setView("space");
    await refresh(true);
  }, [refresh]);
  const closeFile = useCallback(() => setPlace((p) => ({ ...p, selected: null })), []);
  const setSelected = useCallback((id: string | null) => setPlace((p) => ({ ...p, selected: id })), []);
  const dialog = useCallback((type: string, value = "") => {
    setName(value);
    setModal(type);
  }, []);
  const shareOne = useCallback(
    (f: FileMeta) => {
      setShareFile(f);
      dialog("share");
    },
    [dialog],
  );
  const copyLink = useCallback(
    (f: FileMeta) =>
      copyText(`${window.location.origin}/workspace?file=${f.id}`).then(
        () => setNotice("Link copied"),
        () => setError("Could not copy the link."),
      ),
    [setNotice, setError],
  );

  async function submit() {
    setBusy(true);
    try {
      if (modal === "document" || modal === "folder" || modal === "project") {
        const action = modal === "document" ? "create_document" : modal === "folder" ? "create_folder" : "create_project";
        const result = await mutate({
          action,
          name,
          projectId: project,
          folderId: folder,
          content: modal === "document" ? "<p></p>" : undefined,
        });
        if (modal === "document" && result.id) setSelected(result.id);
        if (modal === "project" && result.id) navigate(result.id);
        setNotice(`${modal[0].toUpperCase() + modal.slice(1)} created`);
      } else if (modal === "rename" && file) await mutate({ action: "rename_file", id: file.id, name });
      else if (modal === "move" && file) {
        await mutate({ action: "move_file", id: file.id, projectId: project, folderId: moveFolder || null });
        closeFile();
      } else if (modal === "delete" && file) {
        await mutate({ action: "delete_file", id: file.id });
        closeFile();
        setNotice("Moved to trash");
      } else if (modal === "connect") {
        const result = await mutate({ action: "connect_agent", name: name || provider, provider, permissions, scope, fullAccess });
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
        setReplyEmail("");
        setToken(result.link);
        setModal("invite-link");
        return;
      }
      setModal("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !state || !project) return;
    setBusy(true);
    let newVersions = 0;
    try {
      for (const f of Array.from(files)) {
        const version = await uploadOne(f, { projectId: project, folderId: folder }, state.directUploads);
        if (version > 1) newVersions++;
      }
      await refresh();
      setNotice(uploadNotice(files.length, newVersions));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (upload.current) upload.current.value = "";
    }
  }

  const p = state?.projects.find((x) => x.id === project);
  const currentFolder = folder ? state?.folders.find((f) => f.id === folder) : undefined;
  const shared = shareFile ?? file;
  const shareTarget: ShareTargetRef | null = shared
    ? { type: "file", id: shared.id, name: shared.name }
    : currentFolder
      ? { type: "folder", id: currentFolder.id, name: currentFolder.name }
      : p
        ? { type: "project", id: p.id, name: p.name }
        : null;
  const teamQuery = shared ? `file=${shared.id}` : `project=${project}${currentFolder ? `&folder=${currentFolder.id}` : ""}`;
  const teamLink = `${typeof window === "undefined" ? "" : window.location.origin}/workspace?${teamQuery}`;
  const me = state?.principals.find((x) => x.id === state.currentPrincipalId);

  return {
    ...ws,
    project, folder, selected, file, currentProject: p, currentFolder, me,
    view, setView, tab, setTab, sort, setSort, grid, setGrid,
    rail, setRail, showRail, setShowRail, presence, busy,
    detail, detailError, retryDetail, loadVersion, fileResults, compare, setCompare,
    navigate, openFile, closeFile, reloadWorkspace, setSelected, dialog, shareOne, copyLink, uploadFiles, upload,
    startUpload: () => upload.current?.click(),
    dialogProps: {
      file, agent, busy, submit, dialog, upload, openFile, navigate, mutate, setNotice, setError,
      project, projectName: p?.name ?? "Workspace", modal, setModal, name, setName, search, setSearch,
      provider, setProvider, permissions, setPermissions, scope, setScope, fullAccess, setFullAccess,
      token, setToken, replyEmail, setReplyEmail, inviteRole, setInviteRole, moveFolder, setMoveFolder,
      setAgent, results: search.toLowerCase(), fileResults, shareTarget, teamLink,
    },
  };
}

export type Controller = ReturnType<typeof useController>;
