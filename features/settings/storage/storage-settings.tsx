"use client";
import Link from "next/link";
import { Box, Check, Trash2 } from "lucide-react";
import type { Backup, StorageKind, StorageUsage } from "@/lib/storage-usage";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { formatBytes } from "@/features/workspace/derive";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { useJson } from "../api";
import { Pill, SettingsCard } from "../parts";
import { SettingsShell } from "../settings-shell";

const KIND_COLOR: Record<StorageKind, string> = {
  Presentations: "#2b59d9",
  Documents: "#5b7fe3",
  Spreadsheets: "#7c97e8",
  PDFs: "#9db2ee",
  Images: "#bccbf4",
  Videos: "#d5dff8",
  Other: "#c9c5bc",
};
/** A backup older than this is flagged. */
const STALE_MS = 36 * 3600_000;

const isFresh = (iso: string) => Date.now() - Date.parse(iso) < STALE_MS;
const bytes = (n: number) => (n === 0 ? "0 B" : formatBytes(n));

function when(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const day = days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en", { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

export function StorageSettings() {
  const ws = useWorkspace();
  const usage = useJson<StorageUsage>("/api/storage");
  return (
    <SettingsShell ws={ws} section="storage" title="Storage and backups" description="What you use, and how it’s kept safe.">
      {() =>
        usage.data ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <UsageCard usage={usage.data} />
              <ProjectsCard usage={usage.data} />
              <TrashCard usage={usage.data} />
            </div>
            <BackupsCard backups={usage.data.backups} />
          </div>
        ) : usage.error ? (
          <ErrorState message={usage.error} onRetry={() => void usage.reload()} />
        ) : (
          <div role="status" aria-label="Loading storage" className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-card" />
            <Skeleton className="h-56 rounded-card" />
          </div>
        )
      }
    </SettingsShell>
  );
}

function Tile({ tone, children }: { tone: "accent" | "neutral"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-control ${tone === "accent" ? "bg-accent-soft text-accent" : "bg-segment text-ink-2"}`}
    >
      {children}
    </span>
  );
}

function UsageCard({ usage }: { usage: StorageUsage }) {
  const total = usage.quotaBytes ?? Math.max(usage.usedBytes, 1);
  const free = usage.quotaBytes ? Math.max(0, usage.quotaBytes - usage.usedBytes) : null;
  const percent = usage.quotaBytes ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : null;
  return (
    <SettingsCard>
      <div className="flex flex-col gap-1">
        <span className="text-[0.8125rem] text-muted">Used in this workspace</span>
        <span className="text-[1.875rem] font-semibold tracking-[-0.02em]">
          {bytes(usage.usedBytes)}
          {usage.quotaBytes && <span className="text-base font-normal text-muted"> of {formatBytes(usage.quotaBytes)}</span>}
        </span>
      </div>
      <div
        role="img"
        aria-label={
          percent === null ? `${bytes(usage.usedBytes)} used` : `${bytes(usage.usedBytes)} used, ${Math.round(percent)}% of ${formatBytes(total)}`
        }
        className="flex h-3 overflow-hidden rounded-full bg-[#eceae4]"
      >
        {usage.byKind.map((k) => (
          <span key={k.kind} style={{ width: `${(k.bytes / total) * 100}%`, background: KIND_COLOR[k.kind] }} className="block h-full min-w-[0.1875rem]" />
        ))}
      </div>
      {usage.byKind.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-2.5 p-0 sm:grid-cols-2">
          {usage.byKind.map((k) => (
            <li key={k.kind} className="flex items-center gap-2 text-[0.8125rem]">
              <span aria-hidden className="size-2.5 rounded-[0.1875rem]" style={{ background: KIND_COLOR[k.kind] }} />
              <span className="flex-1 text-ink-2">{k.kind}</span>
              <span className="font-medium">{bytes(k.bytes)}</span>
            </li>
          ))}
          {free !== null && (
            <li className="flex items-center gap-2 text-[0.8125rem]">
              <span aria-hidden className="size-2.5 rounded-[0.1875rem] bg-[#eceae4]" />
              <span className="flex-1 text-ink-2">Available</span>
              <span className="font-medium">{formatBytes(free)}</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="m-0 text-[0.8125rem] text-muted">Nothing stored yet.</p>
      )}
      {(usage.versionBytes > 0 || usage.trashBytes > 0) && (
        <p className="m-0 text-[0.8125rem] leading-normal text-muted">
          Includes {bytes(usage.versionBytes)} of older versions and {bytes(usage.trashBytes)} in the trash.
        </p>
      )}
    </SettingsCard>
  );
}

function ProjectsCard({ usage }: { usage: StorageUsage }) {
  if (!usage.byProject.length) return null;
  return (
    <SettingsCard title="By project">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {usage.byProject.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Tile tone="accent">
              <Box size={17} strokeWidth={1.8} aria-hidden />
            </Tile>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{p.name}</span>
              <span className="text-[0.8125rem] text-muted">
                {p.files} {p.files === 1 ? "file" : "files"} · {p.versions} older {p.versions === 1 ? "version" : "versions"}
              </span>
            </div>
            <span className="text-sm font-semibold">{bytes(p.bytes)}</span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function TrashCard({ usage }: { usage: StorageUsage }) {
  return (
    <SettingsCard>
      <div className="flex flex-wrap items-center gap-3">
        <Tile tone="neutral">
          <Trash2 size={17} strokeWidth={1.8} aria-hidden />
        </Tile>
        <div className="flex min-w-[11.25rem] flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">
            {usage.trashCount ? `${usage.trashCount} ${usage.trashCount === 1 ? "file" : "files"} in the trash · ${bytes(usage.trashBytes)}` : "Trash is empty"}
          </span>
          <span className="text-[0.8125rem] leading-normal text-muted">Deleted files can be restored and still count toward storage.</span>
        </div>
        <Link
          href="/workspace?view=trash"
          className="inline-flex h-9 items-center rounded-[0.5625rem] border border-line bg-card px-3 text-[0.8125rem] font-medium text-ink no-underline hover:bg-subtle"
        >
          Open trash
        </Link>
      </div>
    </SettingsCard>
  );
}

function BackupsCard({ backups }: { backups: Backup[] | null }) {
  const latest = backups?.[0];
  const healthy = !!latest && isFresh(latest.at);
  return (
    <SettingsCard
      title="Backups"
      action={backups && (healthy ? <Pill tone="success">Healthy</Pill> : <Pill tone="warning">{latest ? "Behind" : "None yet"}</Pill>)}
    >
      {backups === null ? (
        <p className="m-0 text-[0.8125rem] leading-normal text-muted">
          Backups run on the server and are not listed here. To show them, set <code className="font-mono text-xs">SPACIE_BACKUP_DIR</code> to the
          folder they are written to.
        </p>
      ) : backups.length === 0 ? (
        <p className="m-0 text-[0.8125rem] text-muted">No backup has been written yet.</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col p-0">
            {backups.slice(0, 7).map((b) => (
              <li key={b.name} className="flex items-center gap-3 border-divider py-3 not-first:border-t first:pt-0 last:pb-0">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check size={14} strokeWidth={2.4} aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{when(b.at)}</span>
                  <span className="truncate text-[0.8125rem] text-muted" title={b.name}>
                    Files and database · {bytes(b.bytes)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[0.8125rem] leading-normal text-muted">
            {backups.length} {backups.length === 1 ? "backup" : "backups"} kept on the server. Restoring one is done from the server.
          </p>
        </>
      )}
    </SettingsCard>
  );
}
