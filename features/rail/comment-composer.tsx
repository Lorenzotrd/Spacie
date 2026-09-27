"use client";
import { useState, type FormEvent } from "react";
import { ArrowUp, X } from "lucide-react";
import { cn } from "@/components/ui/cn";

const MAX_COMMENT = 10_000;

/** Comment input. `onSend` rejects on failure so the draft is kept. */
export function CommentComposer({
  onSend,
  replyingTo,
  onCancelReply,
  placeholder = "Add a comment",
  large = false,
}: {
  onSend: (text: string) => Promise<void>;
  replyingTo?: string | null;
  onCancelReply?: () => void;
  placeholder?: string;
  /** Touch-sized field and button (mobile). */
  large?: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = text.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } catch {
      // The caller surfaces the error; keep the draft so nothing is lost.
    } finally {
      setSending(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      {replyingTo && (
        <button
          type="button"
          onClick={onCancelReply}
          className="inline-flex items-center gap-1 self-start text-xs text-accent-hover"
        >
          Replying to {replyingTo} <X size={12} aria-label="Cancel reply" />
        </button>
      )}
      <div className="flex items-center gap-2.5">
        <label className={cn("flex flex-1 items-center rounded-[0.875rem] bg-[#f4f3ef] px-3.5", large ? "h-[2.875rem]" : "h-10")}>
          <span className="sr-only">{placeholder}</span>
          <input
            value={text}
            maxLength={MAX_COMMENT}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className={cn("w-24 flex-1 border-none bg-transparent text-ink outline-none placeholder:text-muted", large ? "text-[0.9375rem]" : "text-[0.8125rem]")}
          />
        </label>
        <button
          type="submit"
          aria-label="Send comment"
          disabled={!trimmed || sending}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[0.875rem] bg-accent text-white hover:bg-accent-hover disabled:opacity-50",
            large ? "size-[2.875rem]" : "size-10",
          )}
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </div>
    </form>
  );
}
