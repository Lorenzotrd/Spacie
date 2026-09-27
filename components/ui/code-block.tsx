"use client";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyState = "idle" | "copied" | "failed";

/** Copies text, falling back to a hidden textarea where the Clipboard API is blocked. */
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("Copy failed");
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () =>
    copyText(code).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  return (
    <div className="overflow-hidden rounded-xl bg-code">
      <div className="flex h-[2.375rem] items-center border-b border-code-line pr-2 pl-3.5">
        <span className="flex-1 truncate font-mono text-xs text-code-muted">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 items-center gap-1.5 rounded-[0.4375rem] bg-code-line px-2.5 text-xs font-medium text-white hover:bg-[#363942] focus-visible:outline-2 focus-visible:outline-accent"
        >
          {state === "copied" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
        </button>
      </div>
      <pre className="m-0 p-3.5 font-mono text-[0.78125rem] leading-relaxed break-all whitespace-pre-wrap text-code-ink">
        {code}
      </pre>
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}
      </span>
    </div>
  );
}
