"use client";
import type { ReactNode } from "react";
import type { Principal, PublicState } from "@/lib/types";
import { ErrorState, Skeleton } from "@/components/ui/states";
import type { useWorkspace } from "@/features/workspace/use-workspace";
import { SettingsNav, type SettingsSection } from "./settings-nav";

export type SettingsContext = { state: PublicState; me: Principal | undefined; canManage: boolean };

/**
 * Frame shared by every settings page: sidebar, page heading, the page body and the
 * toast. The body renders once the workspace has loaded.
 */
export function SettingsShell({
  ws,
  section,
  title,
  description,
  action,
  children,
}: {
  ws: ReturnType<typeof useWorkspace>;
  section: SettingsSection;
  title: string;
  description: string;
  action?: (ctx: SettingsContext) => ReactNode;
  children: (ctx: SettingsContext) => ReactNode;
}) {
  const { state, error, setError, notice, refresh } = ws;
  if (!state)
    return (
      <div className="flex h-dvh items-center justify-center bg-app p-6">
        {error ? (
          <ErrorState message={error} onRetry={() => void refresh(true).then(() => setError(""), (e: Error) => setError(e.message))} />
        ) : (
          <div role="status" aria-label="Loading settings" className="flex w-72 flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
      </div>
    );

  const me = state.principals.find((p) => p.id === state.currentPrincipalId);
  const canManage = me?.type === "human" && (me.role === "owner" || me.role === "admin");
  const ctx: SettingsContext = { state, me, canManage };
  const agentCount = state.principals.filter((p) => p.type === "agent" && p.status !== "offline").length;

  return (
    <div className="flex min-h-dvh flex-col gap-3.5 bg-app p-3.5 md:h-dvh md:flex-row">
      <SettingsNav
        me={me}
        workspace={state.workspace.name}
        agentCount={agentCount}
        section={section}
        hasAccount={!!state.account}
        canManage={canManage}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-panel border border-line bg-panel">
        <div className="flex flex-col gap-[22px] px-4 pt-6 pb-7 md:px-7 md:pt-[30px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-[13px] text-muted">Settings / {section === "profile" ? "Account" : "Workspace"}</span>
              <h1 className="m-0 text-[26px] font-semibold tracking-[-0.025em] md:text-[30px]">{title}</h1>
              <p className="text-sm text-muted">{description}</p>
            </div>
            {action?.(ctx)}
          </div>
          {children(ctx)}
        </div>
      </main>
      {(error || notice) && (
        <div role={error ? "alert" : "status"} className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">
            {error || notice}
            {error && (
              <button type="button" onClick={() => setError("")} className="min-h-8 rounded-lg px-2 text-white/80 hover:bg-white/10">
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
