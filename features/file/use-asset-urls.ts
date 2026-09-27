"use client";
import { useEffect, useState } from "react";
import type { FileMeta } from "@/lib/types";

async function assetUrl(query: string): Promise<string> {
  const r = await fetch(`/api/assets?${query}`);
  const data = await r.json().catch(() => ({}));
  return r.ok ? (data.url ?? "") : "";
}

/** Signed URLs for an uploaded file's bytes and, for office files, its PDF preview. */
export function useAssetUrls(file: FileMeta | undefined) {
  const [url, setUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const id = file?.id;
  const stored = !!file?.storageKey;
  const key = file?.storageKey;
  const previewReady = file?.previewStatus === "ready";
  useEffect(() => {
    let cancelled = false;
    setUrl("");
    if (id && stored) void assetUrl(`id=${id}`).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [id, stored, key]);
  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    if (id && previewReady) void assetUrl(`id=${id}&preview=1`).then((u) => !cancelled && setPreviewUrl(u));
    return () => {
      cancelled = true;
    };
  }, [id, previewReady, key]);
  return { url, previewUrl };
}

/** Starts a download of the current bytes, or of a document as HTML. */
export async function downloadFile(file: FileMeta, content: string | undefined) {
  if (file.storageKey) {
    const url = await assetUrl(`id=${file.id}&download=1`);
    if (!url) throw new Error("Download failed. Try again.");
    window.location.assign(url);
    return;
  }
  if (content === undefined) throw new Error("The document is still loading.");
  const href = URL.createObjectURL(new Blob([content], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = `${file.name}.html`;
  a.click();
  URL.revokeObjectURL(href);
}
