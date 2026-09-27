"use client";
import { useCallback, useEffect, useRef } from "react";
import type { PublicState } from "@/lib/types";

export type Place = { project: string; folder: string | null; selected: string | null };

/**
 * Mirrors what is open into /workspace?project=…&folder=…&file=… and back.
 * Share links and "Copy link" rely on this URL shape, so it must not change.
 */
export function useDeepLink(
  state: PublicState | null,
  place: Place,
  apply: (next: Place) => void,
) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);
  const fromUrl = useRef(false);
  const applyUrl = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const q = new URLSearchParams(window.location.search);
    const linked = s.files.find((f) => f.id === q.get("file"));
    const project = linked?.projectId ?? q.get("project");
    if (!project || !s.projects.some((p) => p.id === project)) return;
    const folder = linked ? linked.folderId : q.get("folder");
    fromUrl.current = true;
    applyRef.current({
      project,
      folder: folder && s.folders.some((f) => f.id === folder && f.projectId === project) ? folder : null,
      selected: linked?.id ?? null,
    });
  }, []);
  const hydrated = useRef(false);
  useEffect(() => {
    if (!state || hydrated.current) return;
    hydrated.current = true;
    applyUrl();
  }, [state, applyUrl]);
  useEffect(() => {
    window.addEventListener("popstate", applyUrl);
    return () => window.removeEventListener("popstate", applyUrl);
  }, [applyUrl]);
  const { project, folder, selected } = place;
  useEffect(() => {
    if (!hydrated.current || !project) return;
    if (fromUrl.current) {
      fromUrl.current = false;
      return;
    }
    const q = new URLSearchParams({ project });
    if (folder) q.set("folder", folder);
    if (selected) q.set("file", selected);
    const next = `/workspace?${q}`;
    if (next !== window.location.pathname + window.location.search) window.history.pushState(null, "", next);
  }, [project, folder, selected]);
}
