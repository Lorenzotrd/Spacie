"use client";
import {
  Box,
  PanelRight,
  ChevronDown,
  House,
  Search,
  Bell,
  Plus,
  Folder,
  Trash2,
  Settings,
} from "lucide-react";
import type { PublicState, Principal } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
export function AppSidebar({
  state,
  project,
  view,
  folder,
  navigate,
  setView,
  setSelected,
  dialog,
  setAgent,
  setMobileNav,
}: {
  state: PublicState;
  project: string;
  view: string;
  folder: string | null;
  navigate: (projectId: string, folderId?: string | null) => void;
  setView: (view: string) => void;
  setSelected: (id: string | null) => void;
  dialog: (type: string, value?: string) => void;
  setAgent: (person: Principal | null) => void;
  setMobileNav: (open: boolean) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Box size={27} />
        <span>spacie</span>
        <button
          aria-label="Close navigation"
          className="icon-button sidebar-toggle"
          onClick={() => setMobileNav(false)}
        >
          <PanelRight size={16} />
        </button>
      </div>
      <button className="workspace-switch" onClick={() => dialog("workspace")}>
        <span className="workspace-logo">S</span>
        <span>
          <strong>{state.workspace.name}</strong>
          <small>Workspace</small>
        </span>
        <ChevronDown size={16} />
      </button>
      <nav>
        <button
          className={view === "home" ? "selected" : ""}
          onClick={() => {
            setView("home");
            setSelected(null);
          }}
        >
          <House size={17} />
          Home
        </button>
        <button onClick={() => dialog("search")}>
          <Search size={17} />
          Search <kbd>⌘ K</kbd>
        </button>
        <button
          onClick={() => {
            setView("notifications");
            setSelected(null);
          }}
        >
          <Bell size={17} />
          Notifications
        </button>
      </nav>
      <div className="section-label">
        WORKSPACE{" "}
        <button
          className="icon-button"
          aria-label="Create project"
          onClick={() => dialog("project")}
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="project-nav">
        {state.projects.map((x) => (
          <div key={x.id}>
            <button
              className={project === x.id && view === "space" ? "selected" : ""}
              onClick={() => navigate(x.id)}
            >
              <ChevronDown size={13} />
              <span className="project-symbol" style={{ color: x.color }}>
                <Box size={17} />
              </span>
              {x.name}
              {project === x.id && (
                <span className="project-count">
                  {state.files.filter((f) => f.projectId === x.id && !f.deleted)
                    .length +
                    state.folders.filter((f) => f.projectId === x.id).length}
                </span>
              )}
            </button>
            {project === x.id &&
              state.folders
                .filter((f) => f.projectId === x.id && !f.parentId)
                .map((f) => (
                  <button
                    className={`nested ${folder === f.id && view === "space" ? "selected" : ""}`}
                    key={f.id}
                    onClick={() => navigate(x.id, f.id)}
                  >
                    <Folder size={15} />
                    {f.name}
                  </button>
                ))}
          </div>
        ))}
      </div>
      <div className="section-label">
        TEAM{" "}
        <button
          className="icon-button"
          aria-label="Invite teammate"
          onClick={() => dialog("share")}
        >
          <Plus size={14} />
        </button>
      </div>
      {state.principals
        .filter((x) => x.type === "human")
        .map((x) => (
          <button
            key={x.id}
            className="person-nav"
            onClick={() => {
              setAgent(x);
              dialog("person");
            }}
          >
            <Avatar person={x} small />
            {x.name}
            <i
              className={
                x.id === state.currentPrincipalId ? "online" : "offline"
              }
            />
            {x.id === state.currentPrincipalId && <small>you</small>}
          </button>
        ))}
      <div className="section-label">
        <button
          onClick={() => {
            setView("agents");
            setSelected(null);
          }}
        >
          AI TEAMMATES
        </button>
        <button
          className="icon-button"
          aria-label="Connect AI teammate"
          onClick={() => dialog("connect")}
        >
          <Plus size={14} />
        </button>
      </div>
      {state.principals
        .filter((x) => x.type === "agent")
        .map((x) => (
          <button
            key={x.id}
            className="person-nav"
            onClick={() => {
              setAgent(x);
              dialog("agent");
            }}
          >
            <Avatar person={x} small />
            {x.name}
            <i className="offline" />
          </button>
        ))}
      <div className="sidebar-bottom">
        <div className="storage">
          <span>
            {(
              state.files
                .filter((f) => f.storageKey)
                .reduce((n, f) => n + f.size, 0) /
              1024 /
              1024
            ).toFixed(1)}{" "}
            MB stored
          </span>
          <small>{state.demo ? "Local demo" : "Workspace"}</small>
          <div>
            <i />
          </div>
        </div>
        <button
          onClick={() => {
            setView("trash");
            setSelected(null);
          }}
        >
          <Trash2 size={16} />
          Trash
        </button>
        <button onClick={() => dialog("workspace")}>
          <Settings size={16} />
          Workspace settings
        </button>
        <button
          onClick={() => {
            setAgent(
              state.principals.find((p) => p.id === state.currentPrincipalId) ??
                null,
            );
            dialog("person");
          }}
        >
          <Avatar
            person={state.principals.find(
              (p) => p.id === state.currentPrincipalId,
            )}
            small
          />
          <strong>
            {
              state.principals.find((p) => p.id === state.currentPrincipalId)
                ?.name
            }
          </strong>
          <ChevronDown size={14} />
        </button>
      </div>
    </aside>
  );
}
