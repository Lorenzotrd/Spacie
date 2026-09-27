"use client";
import type { Project } from "@/lib/types";

/** Checkbox list of projects, with an optional "all projects" switch. */
export function ProjectPicker({
  projects,
  selected,
  onChange,
  all,
  onAllChange,
}: {
  projects: Project[];
  selected: string[];
  onChange: (ids: string[]) => void;
  all?: boolean;
  onAllChange?: (all: boolean) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1.5 text-[13px] font-medium text-ink">Visible projects</legend>
      {onAllChange && (
        <label className="flex min-h-10 items-center gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-accent" checked={!!all} onChange={(e) => onAllChange(e.target.checked)} />
          All projects, including future ones
        </label>
      )}
      {!all &&
        projects.map((p) => (
          <label key={p.id} className="flex min-h-10 items-center gap-2.5 text-[13px] text-ink-2">
            <input
              type="checkbox"
              className="size-4 accent-accent"
              checked={selected.includes(p.id)}
              onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
            />
            {p.name}
          </label>
        ))}
    </fieldset>
  );
}
