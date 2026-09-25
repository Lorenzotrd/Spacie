"use client";
import { useEffect, useRef, useState } from "react";

/** Long documents render their first pages only; the file stays downloadable. */
const MAX_PAGES = 60;

/**
 * Renders a PDF into canvases with pdf.js. Unlike an iframe this works on mobile,
 * inside a framing-protected app, and for PDF renditions of slides and documents.
 */
export function PdfPreview({ url, title }: { url: string; title: string }) {
  const pages = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    setStatus("loading");
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Preview download failed");
      const task = pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) });
      destroy = () => task.destroy();
      const doc = await task.promise;
      const host = pages.current;
      if (!host || cancelled) return;
      host.replaceChildren();
      const width = host.clientWidth || 800;
      setTruncated(doc.numPages > MAX_PAGES);
      for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
        if (cancelled) return;
        const page = await doc.getPage(n);
        const scale = (width / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "pdf-page";
        canvas.setAttribute("aria-label", `${title}, page ${n}`);
        host.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
        if (n === 1 && !cancelled) setStatus("ready");
      }
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [url, title]);
  return (
    <div className="pdf-preview">
      {status === "loading" && <p className="subtle-copy">Loading preview…</p>}
      {status === "error" && <p className="subtle-copy">This preview could not be displayed. Download the file instead.</p>}
      <div ref={pages} className="pdf-pages" />
      {truncated && <p className="subtle-copy">Showing the first {MAX_PAGES} pages.</p>}
    </div>
  );
}
