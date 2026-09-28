import { File, FileSpreadsheet, FileText, Film, Folder, Image as ImageIcon, Presentation } from "lucide-react";
import type { FileMeta } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { isDocument } from "./derive";

function Glyph({ file, folder, size }: { file?: Pick<FileMeta, "mime" | "name">; folder: boolean; size: number }) {
  const props = { size, strokeWidth: 1.8 };
  if (folder || !file) return <Folder {...props} />;
  const name = file.name.toLowerCase();
  if (isDocument(file) || file.mime === "application/pdf") return <FileText {...props} />;
  if (file.mime.startsWith("image/")) return <ImageIcon {...props} />;
  if (file.mime.startsWith("video/")) return <Film {...props} />;
  if (file.mime.includes("presentation") || /\.(pptx?|key)$/.test(name)) return <Presentation {...props} />;
  if (file.mime.includes("spreadsheet") || /\.(xlsx?|csv)$/.test(name)) return <FileSpreadsheet {...props} />;
  return <File {...props} />;
}

/** Type colours for the tinted tile: slides, sheets and documents stand apart at a glance. */
function tint(file: Pick<FileMeta, "mime" | "name">): string {
  const name = file.name.toLowerCase();
  if (file.mime.includes("presentation") || /\.(pptx?|key)$/.test(name)) return "bg-[#fdf0e8] text-[#b4541a]";
  if (file.mime.includes("spreadsheet") || /\.(xlsx?|csv)$/.test(name)) return "bg-success-soft text-success";
  if (isDocument(file) || file.mime === "application/pdf") return "bg-accent-soft text-accent";
  return "bg-segment text-ink-2";
}

const boxes = {
  sm: "size-[2.125rem] rounded-[0.5625rem]",
  md: "size-10 rounded-[0.6875rem]",
  lg: "size-[2.625rem] rounded-xl",
};

/** A file's type icon in a neutral tile; pass `folder` for folders. */
export function FileIcon({
  file,
  folder = false,
  size = "sm",
  tinted = false,
  className,
}: {
  file?: Pick<FileMeta, "mime" | "name">;
  folder?: boolean;
  size?: keyof typeof boxes;
  /** Colour the tile by file type instead of the neutral grey. */
  tinted?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        tinted && file && !folder ? tint(file) : "bg-[#f3f4f7] text-ink-2",
        boxes[size],
        className,
      )}
    >
      <Glyph file={file} folder={folder} size={size === "sm" ? 16 : 18} />
    </span>
  );
}
