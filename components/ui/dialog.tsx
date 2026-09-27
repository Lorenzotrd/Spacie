"use client";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./cn";

/**
 * Modal with a fixed header: the title and close button never scroll away.
 * Under 768px it is a bottom sheet; above, a centred panel. Only the body scrolls.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Wider panel for side-by-side content. */
  wide?: boolean;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 bg-[#17181c]/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease]" />
        <Primitive.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed z-51 flex flex-col overflow-hidden bg-card text-ink shadow-[0_24px_80px_rgba(23,24,28,0.18)] outline-none",
            // Bottom sheet on phones.
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[20px] pb-[env(safe-area-inset-bottom,0px)] data-[state=open]:animate-[sheet-up_200ms_ease-out]",
            // Centred panel from 768px.
            "md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[85vh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-panel md:pb-0 md:data-[state=open]:animate-[fade-in_150ms_ease]",
            wide ? "md:w-[min(1040px,calc(100vw-32px))]" : "md:w-[min(480px,calc(100vw-32px))]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line md:hidden" />
          <header className="flex shrink-0 items-start gap-3 border-b border-divider px-5 pt-3 pb-3.5 md:px-6 md:pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Primitive.Title className="m-0 truncate text-[17px] font-semibold tracking-[-0.01em] md:text-lg">
                {title}
              </Primitive.Title>
              {description && (
                <Primitive.Description className="m-0 text-[13px] leading-snug text-muted">{description}</Primitive.Description>
              )}
            </div>
            <Primitive.Close
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-segment hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X size={20} aria-hidden />
            </Primitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5 md:px-6 md:pb-6">{children}</div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
