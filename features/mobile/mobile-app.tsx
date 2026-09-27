"use client";
import { useEffect, useRef, useState } from "react";
import type { Controller, View } from "@/features/workspace/use-controller";
import { MobileFile } from "./mobile-file";
import { MobileHome } from "./mobile-home";
import { MobileActivity, MobileMe, MobileProjects } from "./mobile-lists";
import { MobileProject } from "./mobile-project";
import { TabBar } from "./tab-bar";

/** Webapp layout under 768px: one screen at a time and a fixed bottom tab bar. */
export function MobileApp({ ctl, onPerson }: { ctl: Controller; onPerson: (id: string) => void }) {
  // Start on Home unless the URL points at a project or file.
  const started = useRef(false);
  const { setView } = ctl;
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!window.location.search) setView("home");
  }, [setView]);
  const newest = ctl.state!.activity[0]?.id ?? null;
  const [seen, setSeen] = useState(newest);
  useEffect(() => {
    if (ctl.view === "activity") setSeen(newest);
  }, [ctl.view, newest]);
  const unread = !!newest && seen !== newest && ctl.view !== "activity";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ctl.view, ctl.selected, ctl.folder]);

  const go = (view: View) => {
    ctl.closeFile();
    if (view === "space" && ctl.view === "space") ctl.setView("projects");
    else ctl.setView(view);
  };

  if (ctl.view === "space" && ctl.file) return <MobileFile ctl={ctl} file={ctl.file} />;
  const screen =
    ctl.view === "home" ? (
      <MobileHome ctl={ctl} onPerson={onPerson} />
    ) : ctl.view === "projects" ? (
      <MobileProjects ctl={ctl} />
    ) : ctl.view === "activity" ? (
      <MobileActivity ctl={ctl} />
    ) : ctl.view === "me" || ctl.view === "trash" ? (
      <MobileMe ctl={ctl} />
    ) : (
      <MobileProject ctl={ctl} />
    );
  return (
    <div className="min-h-dvh bg-subtle">
      <main>{screen}</main>
      <TabBar current={ctl.view} me={ctl.me} unread={unread} onNavigate={go} onAdd={ctl.startUpload} busy={ctl.busy} />
    </div>
  );
}
