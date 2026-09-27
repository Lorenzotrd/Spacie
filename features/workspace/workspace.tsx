"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { Principal } from "@/lib/types";
import { Brand } from "@/features/shell/brand";
import { CompareVersions } from "@/features/file/compare-versions";
import { Skeleton } from "@/components/ui/states";
import { MobileApp } from "@/features/mobile/mobile-app";
import { useIsMobile } from "./use-media-query";
import { WorkspaceDialogs } from "./dialogs";
import { DesktopApp } from "./desktop-app";
import { useController } from "./use-controller";

function LoadingScreen({ error }: { error: string }) {
  const next = typeof window === "undefined" ? "/workspace" : window.location.pathname + window.location.search;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-app p-6 text-center">
      <Brand />
      {error ? (
        <div role="alert" className="flex flex-col items-center gap-2">
          <p className="text-sm text-ink-2">{error}</p>
          <a href={`/login?next=${encodeURIComponent(next)}`} className="text-sm font-medium">
            Sign in to your workspace →
          </a>
        </div>
      ) : (
        <div role="status" aria-label="Opening your workspace" className="flex w-64 flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}
    </div>
  );
}

export default function Workspace() {
  const ctl = useController();
  const router = useRouter();
  const mobile = useIsMobile();
  const { state, error, setError, notice, offline, dialogProps, dialog, compare, setCompare, upload, uploadFiles } = ctl;
  const { setAgent } = dialogProps;
  const onPerson = useCallback(
    (p: Principal) => {
      if (p.type === "agent") {
        router.push(`/settings/agents?agent=${p.id}`);
        return;
      }
      setAgent(p);
      dialog("person");
    },
    [router, setAgent, dialog],
  );

  if (!state) return <LoadingScreen error={error} />;
  return (
    <>
      {mobile ? (
        <MobileApp ctl={ctl} onPerson={(id) => { const p = state.principals.find((x) => x.id === id); if (p) onPerson(p); }} />
      ) : (
        <DesktopApp ctl={ctl} onPerson={onPerson} />
      )}
      <input
        ref={upload}
        type="file"
        multiple
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void uploadFiles(e.target.files)}
      />
      <WorkspaceDialogs state={state} {...dialogProps} />
      <CompareVersions state={state} target={compare} onClose={() => setCompare(null)} onError={setError} />
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {offline && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-[#fff6ec] px-4 py-2.5 text-[0.8125rem] text-[#8a5a2b] shadow-lg">
            Connection lost. Showing the last saved state and retrying…
          </div>
        )}
        {error && (
          <div role="alert" className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink py-2.5 pr-2 pl-4 text-[0.8125rem] text-white shadow-lg">
            {error}
            <button type="button" aria-label="Dismiss error" onClick={() => setError("")} className="flex size-8 items-center justify-center rounded-lg hover:bg-white/10">
              <X size={15} aria-hidden />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[0.8125rem] text-white shadow-lg">
            <Check size={15} aria-hidden />
            {notice}
          </div>
        )}
      </div>
    </>
  );
}
