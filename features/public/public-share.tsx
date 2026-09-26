"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Box, Download, FileText, Film, Image as ImageIcon, Lock } from "lucide-react";
import { PdfPreview } from "@/features/workspace/pdf-preview";
import { DocumentView } from "@/features/workspace/document-view";

type SharedFile = {
  id: string; name: string; mime: string; size: number; updatedAt: string;
  previewStatus?: string; hasBinary: boolean;
};
type View = {
  kind: "file" | "folder" | "project"; name: string; workspace: string; sharedBy: string;
  allowDownload: boolean; expiresAt: string | null; access: string | null; files: SharedFile[];
};
type Detail = SharedFile & { content: string; previewReady: boolean; allowDownload: boolean };

const DOC = "application/x-spacie-doc";

function icon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={18} />;
  if (mime.startsWith("video/")) return <Film size={18} />;
  return <FileText size={18} />;
}

/** The page behind a public share link: no account, read-only, optional password. */
export function PublicShare({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const headers = useCallback(
    (extra: Record<string, string> = {}) => ({ ...(access ? { "x-share-access": access } : {}), ...extra }),
    [access],
  );

  const load = useCallback(
    async (withPassword?: string) => {
      setError("");
      const r = await fetch(`/api/public?token=${encodeURIComponent(token)}`, {
        headers: headers(withPassword ? { "x-share-password": withPassword } : {}),
        cache: "no-store",
      });
      const data = await r.json();
      if (data.reason === "password_required" || data.reason === "wrong_password" || data.reason === "locked") {
        setNeedsPassword(true);
        setPasswordError(data.reason === "password_required" ? "" : data.error.replace(/^UNAUTHORIZED: /, ""));
        return;
      }
      if (!r.ok) {
        setError(data.error ?? "This link is not available.");
        return;
      }
      setNeedsPassword(false);
      setPasswordError("");
      setAccess(data.access);
      setView(data);
      if (data.kind === "file" && data.files[0]) setOpenId(data.files[0].id);
    },
    [token, headers],
  );

  useEffect(() => {
    void load();
    // First load only; later loads come from the password form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setDetail(null);
    if (!openId) return;
    fetch(`/api/public?token=${encodeURIComponent(token)}&file=${openId}`, { headers: headers(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => undefined);
  }, [openId, token, headers]);

  const assetLink = (file: SharedFile, options: { preview?: boolean; download?: boolean } = {}) => {
    const q = new URLSearchParams({ token, file: file.id });
    if (access) q.set("access", access);
    if (options.preview) q.set("preview", "1");
    if (options.download) q.set("download", "1");
    return `/api/public/asset?${q}`;
  };

  if (error)
    return (
      <div className="loading-screen">
        <Box size={35} />
        <h1>Link unavailable</h1>
        <p>{error} It may have expired or been turned off by its owner.</p>
      </div>
    );

  if (needsPassword)
    return (
      <div className="loading-screen">
        <Lock size={32} />
        <h1>This link is protected</h1>
        <p>Enter the password you were given.</p>
        <form
          style={{ width: 300 }}
          onSubmit={(e) => {
            e.preventDefault();
            void load(password).then(() => setPassword(""));
          }}
        >
          <label className="field-label">
            Password
            <input type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="button primary" style={{ width: "100%", justifyContent: "center" }}>Open</button>
        </form>
        <p role="status">{passwordError}</p>
      </div>
    );

  if (!view)
    return (
      <div className="loading-screen">
        <Box size={35} />
        <p>Opening shared content…</p>
      </div>
    );

  const open = view.files.find((f) => f.id === openId);
  return (
    <div className="public-share">
      <header className="public-bar">
        <span className="public-brand"><Box size={18} /> spacie</span>
        <span className="public-meta">Shared by {view.sharedBy} · {view.workspace}</span>
        {open && open.hasBinary && view.allowDownload && (
          <a className="button" href={assetLink(open, { download: true })}>
            <Download size={15} /> Download
          </a>
        )}
      </header>
      <main className="public-main">
        {open ? (
          <>
            {view.kind !== "file" && (
              <button className="back-button" onClick={() => setOpenId(null)}>
                <ArrowLeft size={15} /> Back to {view.name}
              </button>
            )}
            <h1 className="public-title">{open.name}</h1>
            <SharedBody file={open} detail={detail} assetLink={assetLink} allowDownload={view.allowDownload} />
          </>
        ) : (
          <>
            <h1 className="public-title">{view.name}</h1>
            <p className="subtle-copy">{view.files.length} {view.files.length === 1 ? "file" : "files"}</p>
            <div className="public-files">
              {view.files.map((f) => (
                <button key={f.id} className="public-file" onClick={() => setOpenId(f.id)}>
                  <span className="file-icon">{icon(f.mime)}</span>
                  <span>{f.name}</span>
                  <small>{new Date(f.updatedAt).toLocaleDateString()}</small>
                </button>
              ))}
              {!view.files.length && <p className="subtle-copy">Nothing here yet.</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SharedBody({
  file, detail, assetLink, allowDownload,
}: {
  file: SharedFile;
  detail: Detail | null;
  assetLink: (file: SharedFile, options?: { preview?: boolean; download?: boolean }) => string;
  allowDownload: boolean;
}) {
  if (file.mime === DOC) return detail ? <DocumentView content={detail.content} /> : <p className="subtle-copy">Loading…</p>;
  if (!file.hasBinary) return <p className="subtle-copy">This entry has no file attached.</p>;
  if (file.mime.startsWith("image/"))
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="public-image" src={assetLink(file)} alt={file.name} />;
  if (file.mime.startsWith("video/")) return <video className="public-video" src={assetLink(file)} controls />;
  if (file.mime === "application/pdf") return <PdfPreview url={assetLink(file)} title={file.name} />;
  if (detail?.previewReady) return <PdfPreview url={assetLink(file, { preview: true })} title={file.name} />;
  if (file.previewStatus === "pending" || file.previewStatus === "processing")
    return <p className="subtle-copy">The preview is being prepared. Refresh in a moment.</p>;
  return (
    <p className="subtle-copy">
      No preview for this file.{allowDownload ? " Use Download to open it." : ""}
    </p>
  );
}
