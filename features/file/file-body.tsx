"use client";
import NextImage from "next/image";
import { FileQuestion } from "lucide-react";
import type { FileDetail, FileMeta } from "@/lib/types";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { DocumentEditor } from "@/features/workspace/editor";
import { PdfPreview } from "@/features/workspace/pdf-preview";
import { isDocument } from "@/features/workspace/derive";

/** The file's content: the editor for documents, a preview for uploads. */
export function FileBody({
  file,
  detail,
  url,
  previewUrl,
  onSave,
  onDownload,
  compact = false,
}: {
  file: FileMeta;
  detail: FileDetail | null;
  url: string;
  previewUrl: string;
  onSave: (content: string) => Promise<void>;
  onDownload: () => void;
  /** Mobile: a fixed-height preview card instead of the full view. */
  compact?: boolean;
}) {
  if (isDocument(file)) {
    if (!detail) return <Skeleton className="h-64 w-full" />;
    return <DocumentEditor key={file.id} content={detail.file.content} onSave={onSave} />;
  }
  if (!file.storageKey)
    return <EmptyState icon={<FileQuestion size={20} />} title="No content attached" hint="This entry has no uploaded file." />;
  if (!url) return <Skeleton className={compact ? "h-[196px] w-full rounded-2xl" : "h-96 w-full"} />;
  if (file.mime.startsWith("image/"))
    return (
      <NextImage
        src={url}
        alt={file.name}
        width={1400}
        height={1000}
        unoptimized
        className={compact ? "h-[196px] w-full rounded-2xl border border-line-soft bg-card object-contain" : "h-auto w-full rounded-card object-contain"}
      />
    );
  if (file.mime.startsWith("video/")) return <video src={url} controls className="w-full rounded-card" />;
  const pdf = file.mime === "application/pdf" ? url : previewUrl;
  if (pdf) return <PdfPreview url={pdf} title={file.name} />;
  const preparing = file.previewStatus === "pending" || file.previewStatus === "processing";
  return (
    <EmptyState
      icon={<FileQuestion size={20} />}
      title={preparing ? "Preparing a preview…" : "No preview for this file"}
      hint={preparing ? "This takes a few seconds for decks and documents." : "Download it to open it."}
      action={<Button onClick={onDownload}>Download {file.name}</Button>}
    />
  );
}
