"use client";
import { Fragment } from "react";
import { Link2, PanelRight, Plus } from "lucide-react";
import type { FileMeta, Principal, PublicState } from "@/lib/types";
import { AvatarStack } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { SearchBox } from "./search-box";

export type Crumb = { label: string; onClick?: () => void };

export function TopBar({
  state,
  crumbs,
  members,
  onFile,
  onPerson,
  onShare,
  onNew,
  onToggleRail,
}: {
  state: PublicState;
  crumbs: Crumb[];
  members: Principal[];
  onFile: (f: FileMeta) => void;
  onPerson: (p: Principal) => void;
  onShare: () => void;
  onNew: () => void;
  onToggleRail?: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#eeece7] px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <span aria-hidden>/</span>}
              {c.onClick && !last ? (
                <button type="button" onClick={c.onClick} className="truncate hover:text-ink">
                  {c.label}
                </button>
              ) : (
                <span className={last ? "truncate font-medium text-ink" : "truncate"} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
      <SearchBox state={state} onFile={onFile} onPerson={onPerson} className="ml-auto w-[18.75rem]" />
      {!!members.length && <AvatarStack people={members} />}
      <Button size="lg" onClick={onShare} className="text-[0.8125rem]">
        <Link2 size={16} aria-hidden />
        Share
      </Button>
      <Button size="lg" variant="primary" onClick={onNew} className="text-[0.8125rem]">
        <Plus size={15} aria-hidden />
        New
      </Button>
      {onToggleRail && (
        <IconButton label="Toggle side panel" onClick={onToggleRail}>
          <PanelRight size={17} />
        </IconButton>
      )}
    </header>
  );
}
