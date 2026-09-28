"use client";
import { Plus } from "lucide-react";
import type { FileMeta, Folder } from "@/lib/types";
import { Button } from "@/components/ui/button";

/** Back and front tab colours, cycled so neighbouring folders stay distinct. */
const PALETTES = [
  { back: "#bccbf5", front: "#7c9beb" },
  { back: "#d6cbf3", front: "#a994e6" },
  { back: "#bfe3ce", front: "#7cc39b" },
  { back: "#f3ddb3", front: "#e6b866" },
];

function FolderGlyph({ index }: { index: number }) {
  const { back, front } = PALETTES[index % PALETTES.length];
  return (
    <svg width="34" height="28" viewBox="0 0 34 28" aria-hidden>
      <path d="M0 5a5 5 0 0 1 5-5h8.2a4 4 0 0 1 3 1.4L18.4 4H29a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5z" fill={back} />
      <path d="M0 10a4 4 0 0 1 4-4h26a4 4 0 0 1 4 4v13a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5z" fill={front} />
    </svg>
  );
}

/** Folders of the current place as cards, under a header that holds the "New folder" button. */
export function FolderCards({
  folders,
  files,
  onOpen,
  onNew,
}: {
  folders: Folder[];
  files: readonly FileMeta[];
  onOpen: (folder: Folder) => void;
  onNew: () => void;
}) {
  const countIn = (id: string) => files.filter((f) => f.folderId === id && !f.deleted).length;
  return (
    <section aria-label="Folders" className="flex flex-col gap-3">
      <div className="flex items-center">
        <h2 className="m-0 text-sm font-semibold">Folders</h2>
        <Button onClick={onNew} className="ml-auto font-normal text-ink-2">
          <Plus size={15} aria-hidden />
          New folder
        </Button>
      </div>
      {folders.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
          {folders.map((f, i) => {
            const n = countIn(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpen(f)}
                className="flex h-[6.75rem] flex-col items-start justify-between rounded-card border border-line-soft bg-card p-4 text-left hover:border-line"
              >
                <FolderGlyph index={i} />
                <span className="flex max-w-full min-w-0 flex-col gap-[0.1875rem]">
                  <span className="truncate text-sm font-semibold text-ink">{f.name}</span>
                  <span className="text-xs text-muted">
                    {n} file{n === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[0.8125rem] text-muted">No folders yet. Create one to group related files.</p>
      )}
    </section>
  );
}
