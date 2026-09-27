"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Box, Copy, Eye, Link2, Lock } from "lucide-react";
import type { LinkDefaults, WorkspaceShareLink } from "@/lib/share-links";
import type { PublicState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyText } from "@/components/ui/code-block";
import { FileMenu } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { FileIcon } from "@/features/workspace/file-icon";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { postJson, useJson } from "../api";
import { Pill, SettingRow, SettingsCard, Stat } from "../parts";
import { SettingsShell } from "../settings-shell";

type Links = { links: WorkspaceShareLink[]; defaults: LinkDefaults };
type Expiry = "7" | "30" | "90" | "never";
const EXPIRIES: { id: Expiry; label: string }[] = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "never", label: "Never" },
];
const TYPE = { file: "File", folder: "Folder", project: "Project" };
const COLUMNS = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_130px]";

function expiresIn(link: WorkspaceShareLink) {
  if (!link.expiresAt) return "Never";
  const days = Math.ceil((Date.parse(link.expiresAt) - Date.now()) / 86_400_000);
  return days <= 1 ? "Today" : `In ${days} days`;
}

/** Where "Open" goes: the same deep link the workspace uses. */
function hrefOf(link: WorkspaceShareLink) {
  const { type, id, projectId, folderId } = link.target;
  if (type === "file") return `/workspace?file=${id}`;
  const q = new URLSearchParams({ project: projectId });
  if (type === "folder" && folderId) q.set("folder", folderId);
  return `/workspace?${q}`;
}

export function LinksSettings() {
  const ws = useWorkspace();
  const data = useJson<Links>("/api/share-links?scope=workspace");
  return (
    <SettingsShell ws={ws} section="links" title="Public links" description="Everything shared outside your workspace, in one place.">
      {({ state, canManage }) =>
        data.data ? (
          <LinksBody data={data.data} state={state} canManage={canManage} reload={data.reload} notify={ws.setNotice} fail={ws.setError} />
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={() => void data.reload()} />
        ) : (
          <div role="status" aria-label="Loading public links" className="flex flex-col gap-4">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        )
      }
    </SettingsShell>
  );
}

function LinksBody({
  data,
  state,
  canManage,
  reload,
  notify,
  fail,
}: {
  data: Links;
  state: PublicState;
  canManage: boolean;
  reload: () => Promise<void>;
  notify: (m: string) => void;
  fail: (m: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const active = data.links.filter((l) => l.status === "active");
  const views = data.links.reduce((sum, l) => sum + l.viewCount, 0);

  const post = async (key: string, body: object, done: string) => {
    setBusy(key);
    try {
      await postJson("/api/share-links", body);
      await reload();
      notify(done);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  };
  const copy = (url: string) => void copyText(url).then(() => notify("Link copied"), () => fail("Copy failed. Open the link and copy it from the address bar."));

  const icon = (link: WorkspaceShareLink) => {
    if (link.target.type === "project")
      return (
        <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#f3f4f7] text-ink-2">
          <Box size={17} strokeWidth={1.8} />
        </span>
      );
    const file = state.files.find((f) => f.id === link.target.id);
    return <FileIcon folder={link.target.type === "folder"} file={file ?? { mime: "", name: link.target.name }} />;
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Stat label="Active links" value={active.length} />
        <Stat label="Views, all time" value={views} />
        <Stat
          label="With a password"
          value={
            <>
              {active.filter((l) => l.hasPassword).length}
              <span className="text-base font-normal text-muted"> of {active.length}</span>
            </>
          }
        />
      </div>

      <Card className="overflow-hidden">
        {data.links.length === 0 ? (
          <EmptyState
            icon={<Link2 size={18} aria-hidden />}
            title="No public links yet"
            hint="Open a file, folder or project and use Share to create a link anyone can open."
          />
        ) : (
          <>
            <div className={`hidden h-[42px] items-center gap-3 border-b border-[#efede8] bg-subtle px-[18px] text-xs font-medium text-muted md:grid ${COLUMNS}`}>
              <span>Shared item</span>
              <span>Type</span>
              <span>Expires</span>
              <span>Protection</span>
              <span>Views</span>
              <span>Active</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="m-0 list-none p-0" aria-label="Public links">
              {data.links.map((link) => (
                <li
                  key={link.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-[#f3f1ed] px-4 py-3 not-first:border-t md:min-h-16 md:px-[18px] md:py-2 ${COLUMNS}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {icon(link)}
                    <span className="truncate text-sm font-medium" title={link.target.name}>
                      {link.target.name}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 max-md:col-span-2 max-md:row-start-2 md:contents">
                    <Cell>
                      {TYPE[link.target.type]} · {link.allowDownload ? "download" : "view only"}
                    </Cell>
                    <Cell>{link.status === "expired" ? <Pill tone="danger">Expired</Pill> : expiresIn(link)}</Cell>
                    <Cell>
                      {link.hasPassword ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <Lock size={14} className="text-accent" aria-hidden />
                          Password
                        </span>
                      ) : (
                        <span className="text-[#a3a5ac] max-md:hidden">No password</span>
                      )}
                    </Cell>
                    <Cell className="max-md:hidden">
                      <span className="inline-flex items-center gap-1.5 text-ink-2" aria-label={`${link.viewCount} views`}>
                        <Eye size={14} className="text-muted" aria-hidden />
                        {link.viewCount}
                      </span>
                    </Cell>
                    <div className="flex items-center gap-2 max-md:ml-auto">
                      {link.status === "expired" ? (
                        <span className="text-[13px] text-[#a3a5ac]">Off</span>
                      ) : (
                        <Toggle
                          checked={link.status === "active"}
                          disabled={!link.canManage || busy === link.id}
                          label={`Link to ${link.target.name} is ${link.status === "active" ? "on" : "off"}`}
                          onChange={(on) =>
                            void post(link.id, { action: on ? "restore" : "revoke", id: link.id }, on ? "Link turned back on" : "Link turned off")
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 max-md:col-start-2 max-md:row-start-1">
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={link.status !== "active"}
                      onClick={() => copy(link.url)}
                      aria-label={`Copy the link to ${link.target.name}`}
                    >
                      <Copy size={14} aria-hidden />
                      Copy
                    </Button>
                    <FileMenu
                      label={`Actions for the link to ${link.target.name}`}
                      items={[
                        { label: `Open ${TYPE[link.target.type].toLowerCase()}`, onSelect: () => router.push(hrefOf(link)) },
                        ...(link.status === "active" ? [{ label: "Open public page", onSelect: () => window.open(link.url, "_blank", "noopener") }] : []),
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <DefaultsCard defaults={data.defaults} canManage={canManage} reload={reload} notify={notify} fail={fail} />
    </>
  );
}

function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-[13px] text-ink-2 ${className}`}>{children}</span>;
}

function DefaultsCard({
  defaults,
  canManage,
  reload,
  notify,
  fail,
}: {
  defaults: LinkDefaults;
  canManage: boolean;
  reload: () => Promise<void>;
  notify: (m: string) => void;
  fail: (m: string) => void;
}) {
  const [value, setValue] = useState(defaults);
  const save = async (next: LinkDefaults) => {
    const before = value;
    setValue(next);
    try {
      await postJson("/api/share-links", { action: "defaults", ...next });
      await reload();
      notify("Defaults saved");
    } catch (e) {
      setValue(before);
      fail(e instanceof Error ? e.message : "Could not save the defaults.");
    }
  };
  const expiry: Expiry = value.expiresInDays === null ? "never" : (String(value.expiresInDays) as Expiry);
  return (
    <SettingsCard title="Defaults for new links">
      {!canManage && <p className="-mt-2 text-[13px] text-muted">Only owners and admins can change these.</p>}
      <div className="grid gap-x-10 gap-y-3.5 lg:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <SettingRow label="Expires after" hint="Links switch off on their own.">
            <Tabs
              label="Expires after"
              items={EXPIRIES}
              value={expiry}
              onChange={(id) => canManage && void save({ ...value, expiresInDays: id === "never" ? null : (Number(id) as 7 | 30 | 90) })}
              className={canManage ? "" : "pointer-events-none opacity-60"}
            />
          </SettingRow>
          <SettingRow label="Ask for a password" hint="The Share dialog asks for one first. Locks after 10 wrong tries.">
            <Toggle checked={value.askPassword} disabled={!canManage} label="Ask for a password" onChange={(askPassword) => void save({ ...value, askPassword })} />
          </SettingRow>
        </div>
        <div className="flex flex-col gap-3.5 max-lg:border-t max-lg:border-divider max-lg:pt-3.5">
          <SettingRow label="Allow downloads" hint="Otherwise people can only view.">
            <Toggle checked={value.allowDownload} disabled={!canManage} label="Allow downloads" onChange={(allowDownload) => void save({ ...value, allowDownload })} />
          </SettingRow>
        </div>
      </div>
    </SettingsCard>
  );
}
