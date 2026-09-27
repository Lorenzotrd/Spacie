"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Copy, Globe, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { copyText } from "@/components/ui/code-block";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import type { PublicState } from "@/lib/types";

export type ShareTargetRef = { type: "file" | "folder" | "project"; id: string; name: string };
type Link = {
  id: string; url: string; allowDownload: boolean; hasPassword: boolean;
  expiresAt: string | null; viewCount: number; lastViewedAt: string | null;
};
type Expiry = "7" | "30" | "90" | "never";
type Mode = "team" | "public" | "invite";

const EXPIRIES: { id: Expiry; label: string }[] = [
  { id: "7", label: "7 d" },
  { id: "30", label: "30 d" },
  { id: "90", label: "90 d" },
  { id: "never", label: "Never" },
];
const MODES: { id: Mode; label: string }[] = [
  { id: "team", label: "Team link" },
  { id: "public", label: "Public link" },
  { id: "invite", label: "Invite" },
];

function expiryLabel(link: Link) {
  if (!link.expiresAt) return "Never expires";
  const days = Math.max(0, Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 86_400_000));
  return days <= 1 ? "Expires today" : `Expires in ${days} days`;
}

/** A link shown as one tappable row: the URL, then Copy. */
function LinkRow({ url, label, onCopy, children }: { url: string; label: string; onCopy: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line-soft bg-subtle py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </span>
      <Button size="sm" onClick={onCopy} aria-label={`Copy ${label}`} className="h-9 px-3">
        <Copy size={14} aria-hidden />
        Copy
      </Button>
      {children}
    </div>
  );
}

/** Share dialog body: team link, public links for this resource, and workspace invitations. */
export function SharePanel({
  target, teamLink, defaults, onNotice, onError, children,
}: {
  target: ShareTargetRef;
  teamLink: string;
  /** Workspace defaults from Settings > Public links. */
  defaults?: PublicState["linkDefaults"];
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  /** The invitation form, shown in the Invite tab. */
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("team");
  const [links, setLinks] = useState<Link[]>([]);
  const [expiry, setExpiry] = useState<Expiry>(
    defaults ? (defaults.expiresInDays === null ? "never" : (String(defaults.expiresInDays) as Expiry)) : "30",
  );
  const [allowDownload, setAllowDownload] = useState(defaults?.allowDownload ?? true);
  const [password, setPassword] = useState("");
  const askPassword = !!defaults?.askPassword;
  const [settings, setSettings] = useState(askPassword);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const copy = (value: string, message: string) =>
    void copyText(value).then(
      () => {
        setCopied(value);
        onNotice(message);
      },
      () => onError("Copy failed. Select the link and copy it by hand."),
    );

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/share-links?type=${target.type}&id=${target.id}`, { cache: "no-store" });
    if (r.ok) setLinks(await r.json());
  }, [target.type, target.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function post(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refresh();
      return data;
    } catch (e) {
      onError(e instanceof Error ? e.message.replace(/^FORBIDDEN: /, "") : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const link = await post({
      action: "create",
      target: { type: target.type, id: target.id },
      expiresInDays: expiry === "never" ? null : Number(expiry),
      allowDownload,
      password: password || undefined,
    });
    if (link) {
      setPassword("");
      setSettings(askPassword);
      copy(link.url, "Public link created and copied");
    }
  }

  const what = target.type === "file" ? "this file" : `everything in this ${target.type}`;
  const needsPassword = askPassword && password.trim().length < 8;
  const summary = [
    expiry === "never" ? "Never expires" : `Expires in ${expiry} days`,
    allowDownload ? "Download allowed" : "View only",
    ...(password ? ["Password"] : []),
  ].join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <Tabs label="How to share" items={MODES} value={mode} onChange={setMode} stretch />

      {mode === "team" && (
        <section className="flex flex-col gap-2.5">
          <p className="m-0 text-[13px] text-muted">For people in this workspace who can already open it.</p>
          <LinkRow url={teamLink} label="team link" onCopy={() => copy(teamLink, "Team link copied")} />
        </section>
      )}

      {mode === "public" && (
        <section className="flex flex-col gap-3">
          <p className="m-0 text-[13px] text-muted">Anyone with the link can view {what}, without an account.</p>
          {links.map((link) => (
            <div key={link.id} className="flex flex-col gap-1">
              <LinkRow url={link.url} label="public link" onCopy={() => copy(link.url, "Public link copied")}>
                <IconButton
                  label="Turn off this link"
                  disabled={busy}
                  onClick={() => void post({ action: "revoke", id: link.id })}
                  className="size-9 text-danger hover:bg-[#fcf2f1]"
                >
                  <Trash2 size={15} />
                </IconButton>
              </LinkRow>
              <span className="pl-1 text-xs text-muted">
                {expiryLabel(link)} · {link.allowDownload ? "Download allowed" : "View only"}
                {link.hasPassword ? " · Password" : ""} · {link.viewCount} {link.viewCount === 1 ? "view" : "views"}
              </span>
            </div>
          ))}

          <div className="flex flex-col gap-3 rounded-xl border border-line-soft p-3">
            <div className="flex items-center gap-2">
              <Globe size={15} className="text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{summary}</span>
              <button
                type="button"
                aria-expanded={settings}
                onClick={() => setSettings(!settings)}
                className="min-h-9 px-1 text-[13px] font-medium text-accent-hover"
              >
                {settings ? "Done" : "Change"}
              </button>
            </div>
            {settings && (
              <div className="flex flex-col gap-3 border-t border-divider pt-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-2">Expires after</span>
                  <Tabs label="Expires after" items={EXPIRIES} value={expiry} onChange={setExpiry} stretch />
                </div>
                <label className="flex flex-col gap-1.5 text-xs font-medium text-ink-2">
                  {askPassword ? "Password" : "Password (optional)"}
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required={askPassword}
                    className="h-10 rounded-control border border-line bg-card px-3 text-sm font-normal text-ink outline-none focus:border-accent"
                  />
                </label>
                <div className="flex min-h-11 items-center gap-3">
                  <span className="flex-1 text-[13px] text-ink-2">Allow downloading the original</span>
                  <Toggle checked={allowDownload} onChange={setAllowDownload} label="Allow downloading the original" />
                </div>
              </div>
            )}
            <Button variant="primary" size="lg" disabled={busy || needsPassword} onClick={() => void create()} className="w-full">
              {busy ? "Creating…" : needsPassword ? "Add a password first" : links.length ? "Create another link" : "Create and copy link"}
            </Button>
          </div>
        </section>
      )}

      {mode === "invite" && (
        <section className="flex flex-col gap-2.5">
          <p className="m-0 text-[13px] text-muted">Add someone to the whole workspace with a single-use link.</p>
          {children}
        </section>
      )}

      <span role="status" className="sr-only">{copied ? "Copied" : ""}</span>
    </div>
  );
}
