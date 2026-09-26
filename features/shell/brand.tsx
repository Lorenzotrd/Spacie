import { Box } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent text-white">
        <Box size={17} strokeWidth={2} aria-hidden />
      </span>
      <span className="text-xl font-bold tracking-[-0.02em]">spacie</span>
    </div>
  );
}

/** The workspace card; there is one workspace per account, so it is informational. */
export function WorkspaceCard({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-card p-2.5">
      <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-ink text-[15px] font-bold text-white">
        {name[0]?.toUpperCase() ?? "S"}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="text-xs text-muted">Workspace</span>
      </div>
    </div>
  );
}
