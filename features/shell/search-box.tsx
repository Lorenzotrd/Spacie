"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import type { FileMeta, Principal, PublicState } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { useFileSearchState } from "@/features/workspace/use-file-detail";
import { FileIcon } from "@/features/workspace/file-icon";

type Result = { kind: "file"; file: FileMeta } | { kind: "person"; person: Principal };

/**
 * The one search in the app: files (names, text, comments) and people.
 * ⌘K / Ctrl+K focuses it from anywhere.
 */
export function SearchBox({
  state,
  onFile,
  onPerson,
  className,
}: {
  state: PublicState;
  onFile: (f: FileMeta) => void;
  onPerson: (p: Principal) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results: files, status } = useFileSearchState<FileMeta>(query);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const people = q
    ? state.principals.filter((p) => p.name.toLowerCase().includes(q) && (p.type === "human" || p.status !== "offline"))
    : [];
  const results: Result[] = [
    ...files.slice(0, 8).map((file) => ({ kind: "file" as const, file })),
    ...people.slice(0, 4).map((person) => ({ kind: "person" as const, person })),
  ];
  const expanded = open && !!q;

  const choose = (r: Result) => {
    if (r.kind === "file") onFile(r.file);
    else onPerson(r.person);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  };
  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name ?? "";

  return (
    <div className={cn("relative", className)}>
      <label className="flex h-[2.375rem] items-center gap-2.5 rounded-control border border-line bg-card px-3 focus-within:border-accent">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          ref={input}
          role="combobox"
          aria-label="Search files and people"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && results[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder="Search a file or a person"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="w-24 flex-1 border-none bg-transparent text-[0.8125rem] text-ink outline-none placeholder:text-muted"
        />
        <kbd className="rounded-[0.3125rem] border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted">⌘K</kbd>
      </label>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-40 max-h-[22.5rem] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-[0_12px_32px_rgba(23,24,28,0.12)]"
        >
          {results.map((r, i) => (
            <li
              key={r.kind === "file" ? r.file.id : r.person.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[0.8125rem]",
                i === active && "bg-accent-tint",
              )}
            >
              {r.kind === "file" ? (
                <>
                  <FileIcon file={r.file} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-ink">{r.file.name}</span>
                    <span className="truncate text-xs text-muted">{projectName(r.file.projectId)}</span>
                  </span>
                </>
              ) : (
                <>
                  <Avatar person={r.person} size="sm" />
                  <span className="truncate font-medium text-ink">{r.person.name}</span>
                  <span className="ml-auto text-xs text-muted">{r.person.type === "agent" ? "AI agent" : "Person"}</span>
                </>
              )}
            </li>
          ))}
          {!results.length && (
            <li role="status" className="px-2 py-3 text-[0.8125rem] text-muted">
              {status === "loading"
                ? "Searching…"
                : status === "error"
                  ? "Search is unavailable right now. Try again in a moment."
                  : `No matches for “${query}”.`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
