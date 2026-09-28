"use client";
import type { Principal } from "@/lib/types";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { TopBar, type Crumb } from "@/features/shell/top-bar";
import { ProjectView } from "@/features/project/project-view";
import { FileView } from "@/features/file/file-view";
import { RightRail } from "@/features/rail/right-rail";
import { projectMembers } from "./derive";
import { ActivityView, HomeView, TrashView } from "./secondary-views";
import type { Controller } from "./use-controller";

/** 1440px layout: sidebar, then a rounded main panel with the top bar, content and, on a file, the right rail. */
export function DesktopApp({ ctl, onPerson }: { ctl: Controller; onPerson: (p: Principal) => void }) {
  const state = ctl.state!;
  const inSpace = ctl.view === "space";
  const crumbs: Crumb[] = [{ label: state.workspace.name, onClick: () => ctl.setView("home") }];
  if (inSpace && ctl.currentProject) crumbs.push({ label: ctl.currentProject.name, onClick: () => ctl.navigate(ctl.project) });
  if (inSpace && ctl.currentFolder) crumbs.push({ label: ctl.currentFolder.name, onClick: ctl.closeFile });
  if (inSpace && ctl.file) crumbs.push({ label: ctl.file.name });
  if (!inSpace) crumbs.push({ label: ctl.view === "home" ? "Home" : ctl.view === "trash" ? "Trash" : "Activity" });
  const compare = (fileId: string, version?: number) => ctl.setCompare({ fileId, version });

  const content = !inSpace ? (
    ctl.view === "home" ? <HomeView ctl={ctl} /> : ctl.view === "trash" ? <TrashView ctl={ctl} /> : <ActivityView ctl={ctl} />
  ) : ctl.file ? (
    <FileView ctl={ctl} file={ctl.file} onCompare={() => compare(ctl.file!.id)} />
  ) : ctl.currentProject ? (
    <ProjectView ctl={ctl} onCompare={compare} onPerson={onPerson} />
  ) : (
    <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted">
      No projects yet. Create one from the sidebar to get started.
    </div>
  );

  return (
    <div className="flex h-dvh gap-3.5 bg-app p-3.5">
      <AppSidebar
        state={state}
        project={ctl.project}
        folder={ctl.folder}
        view={ctl.view}
        presence={ctl.presence}
        me={ctl.me}
        navigate={ctl.navigate}
        setView={ctl.setView}
        onNewProject={() => ctl.dialog("project")}
        onPerson={onPerson}
        onWorkspaceChanged={ctl.reloadWorkspace}
        onError={ctl.setError}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-panel">
        <TopBar
          state={state}
          crumbs={crumbs}
          members={inSpace ? projectMembers(state, ctl.project) : []}
          onFile={ctl.openFile}
          onPerson={onPerson}
          onShare={() => ctl.dialog("share")}
          onNew={() => ctl.dialog("new")}
          onToggleRail={inSpace && ctl.file && !ctl.showRail ? () => ctl.setShowRail(true) : undefined}
        />
        <div className="flex min-h-0 flex-1">
          {content}
          {inSpace && ctl.showRail && ctl.file && <RightRail ctl={ctl} file={ctl.file} onCompare={compare} />}
        </div>
      </main>
    </div>
  );
}
