"use client";
import { useState } from "react";
import type { UserPreferences } from "@/lib/types";
import { Tabs } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { postJson } from "../api";
import { SettingRow, SettingsCard } from "../parts";
import { SettingsShell } from "../settings-shell";

const DENSITY = [
  { id: "comfortable", label: "Comfortable" },
  { id: "compact", label: "Compact" },
] as const;
const SORT = [
  { id: "recent", label: "Recent first" },
  { id: "name", label: "Name A–Z" },
] as const;

/** Display preferences. Each change saves on its own and applies right away. */
export function PreferencesSettings() {
  const ws = useWorkspace();
  return (
    <SettingsShell ws={ws} section="preferences" title="Preferences" description="Make Atelio work the way you do.">
      {({ state }) =>
        !state.account ? (
          <p className="text-sm text-muted">Sign in with your account to set your preferences.</p>
        ) : (
          <PreferencesBody
            saved={state.preferences}
            save={async (change) => {
              await postJson("/api/account", { action: "update_preferences", preferences: change });
              await ws.refresh(true);
              ws.setNotice("Preferences saved");
            }}
            fail={ws.setError}
          />
        )
      }
    </SettingsShell>
  );
}

function PreferencesBody({
  saved,
  save,
  fail,
}: {
  saved: UserPreferences | undefined;
  save: (change: Partial<UserPreferences>) => Promise<void>;
  fail: (message: string) => void;
}) {
  // Shown optimistically; the saved value wins again once the workspace reloads.
  const [pending, setPending] = useState<Partial<UserPreferences>>({});
  const prefs = { density: "comfortable", sort: "recent", openPanel: true, timeZone: null, ...saved, ...pending } as UserPreferences;
  const change = (next: Partial<UserPreferences>) => {
    setPending((p) => ({ ...p, ...next }));
    save(next)
      .catch((e: Error) => fail(e.message))
      .finally(() => setPending({}));
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingsCard title="Appearance">
        <SettingRow label="Density" hint="Space between rows in file lists, activity and members.">
          <Tabs label="Density" items={[...DENSITY]} value={prefs.density} onChange={(density) => change({ density })} />
        </SettingRow>
        <SettingRow label="Default sort" hint="How project files are ordered when you open Atelio.">
          <Tabs label="Default sort" items={[...SORT]} value={prefs.sort} onChange={(sort) => change({ sort })} />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title="Files">
        <SettingRow label="Open the side panel with a file" hint="Activity, comments and versions next to the file. You can still open it from the top bar.">
          <Toggle checked={prefs.openPanel} onChange={(openPanel) => change({ openPanel })} label="Open the side panel with a file" />
        </SettingRow>
      </SettingsCard>
    </div>
  );
}
