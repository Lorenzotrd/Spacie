"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Globe, Link as LinkIcon, Users } from "lucide-react";

export type ShareTargetRef = { type: "file" | "folder" | "project"; id: string; name: string };
type Link = {
  id: string; url: string; allowDownload: boolean; hasPassword: boolean;
  expiresAt: string | null; viewCount: number; lastViewedAt: string | null;
};
type Expiry = "7" | "30" | "90" | "never";

function expiryLabel(link: Link) {
  if (!link.expiresAt) return "Never expires";
  const days = Math.max(0, Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 86_400_000));
  return days <= 1 ? "Expires today" : `Expires in ${days} days`;
}

/** Share dialog body: team link, public links for this resource, and workspace invitations. */
export function SharePanel({
  target, teamLink, onNotice, onError, children,
}: {
  target: ShareTargetRef;
  teamLink: string;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  children: ReactNode;
}) {
  const [links, setLinks] = useState<Link[]>([]);
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [allowDownload, setAllowDownload] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = (value: string, message: string) =>
    void navigator.clipboard.writeText(value).then(() => onNotice(message), () => onError("Copy failed"));

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
      copy(link.url, "Public link created and copied");
    }
  }

  return (
    <div className="share-panel">
      <section>
        <h3><Users size={15} /> Team link</h3>
        <p className="subtle-copy">Works for people in this workspace who can already see it.</p>
        <div className="share-row">
          <input readOnly value={teamLink} onFocus={(e) => e.target.select()} aria-label="Team link" />
          <button className="button" onClick={() => copy(teamLink, "Team link copied")}>
            <LinkIcon size={14} /> Copy
          </button>
        </div>
      </section>

      <section>
        <h3><Globe size={15} /> Public link</h3>
        <p className="subtle-copy">
          Anyone with the link can view {target.type === "file" ? "this file" : `everything in this ${target.type}`},
          without an account.
        </p>
        {links.map((link) => (
          <div className="share-link" key={link.id}>
            <div className="share-row">
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label="Public link" />
              <button className="button" onClick={() => copy(link.url, "Public link copied")}>Copy</button>
              <button className="button danger" disabled={busy} onClick={() => void post({ action: "revoke", id: link.id })}>
                Turn off
              </button>
            </div>
            <small>
              {expiryLabel(link)} · {link.allowDownload ? "Download allowed" : "View only"}
              {link.hasPassword ? " · Password" : ""} · {link.viewCount} {link.viewCount === 1 ? "view" : "views"}
            </small>
          </div>
        ))}
        <div className="share-options">
          <label className="field-label">
            Expires
            <select value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)}>
              <option value="7">In 7 days</option>
              <option value="30">In 30 days</option>
              <option value="90">In 90 days</option>
              <option value="never">Never</option>
            </select>
          </label>
          <label className="field-label">
            Password (optional)
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <label className="check-label">
          <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
          Allow downloading the original files
        </label>
        <button className="button primary modal-submit" disabled={busy} onClick={() => void create()}>
          {links.length ? "Create another public link" : "Create public link"}
        </button>
      </section>

      <details className="share-invite">
        <summary><Users size={15} /> Invite people to the workspace</summary>
        {children}
      </details>
    </div>
  );
}
