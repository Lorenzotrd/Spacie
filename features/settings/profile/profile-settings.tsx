"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { MIN_PASSWORD } from "@/lib/password-rules";
import type { Profile, SessionSummary } from "@/lib/profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { relativeTime } from "@/features/workspace/derive";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { postJson, useJson } from "../api";
import { Field, Pill, SettingRow, SettingsCard } from "../parts";
import { SettingsShell } from "../settings-shell";
import { describeDevice } from "./device";

type Account = { profile: Profile; sessions: SessionSummary[] };

export function ProfileSettings() {
  const ws = useWorkspace();
  const account = useJson<Account>("/api/account");
  return (
    <SettingsShell ws={ws} section="profile" title="Profile" description="How you appear to your team and your agents.">
      {({ me }) =>
        account.data ? (
          <ProfileBody
            key={account.data.profile.name}
            account={account.data}
            me={me}
            reload={async () => {
              await Promise.all([account.reload(), ws.refresh(true)]);
            }}
            notify={ws.setNotice}
            fail={ws.setError}
          />
        ) : account.error ? (
          <ErrorState message={account.error} onRetry={() => void account.reload()} />
        ) : (
          <div role="status" aria-label="Loading your profile" className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        )
      }
    </SettingsShell>
  );
}

function ProfileBody({
  account,
  me,
  reload,
  notify,
  fail,
}: {
  account: Account;
  me: Parameters<typeof Avatar>[0]["person"];
  reload: () => Promise<void>;
  notify: (m: string) => void;
  fail: (m: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(account.profile.name);
  const [busy, setBusy] = useState("");
  const [changing, setChanging] = useState(false);
  const others = account.sessions.filter((s) => !s.current);

  const act = async (key: string, body: object, done: string) => {
    setBusy(key);
    try {
      await postJson("/api/account", body);
      await reload();
      notify(done);
    } catch (e) {
      fail(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    void act("profile", { action: "update_profile", name }, "Profile saved");
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <SettingsCard title="Personal info">
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar person={me && { ...me, name: name || me.name, initials: (name || me.name)[0] ?? "?" }} size="lg" className="size-16 text-[1.5625rem]" />
            <p className="text-[0.8125rem] leading-normal text-muted">Your initial is your avatar everywhere in Spacie. Agents get the blue mark.</p>
          </div>
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
          <Field label="Email" value={account.profile.email} readOnly hint="You sign in with this address." />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={busy === "profile" || !name.trim() || name.trim() === account.profile.name}>
              {busy === "profile" ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <div className="flex flex-col gap-4">
        <SettingsCard title="Security">
          <SettingRow label="Password" hint={`At least ${MIN_PASSWORD} characters. Other devices are signed out when you change it.`}>
            <Button onClick={() => setChanging(true)} disabled={!account.profile.hasPassword}>
              Change password
            </Button>
          </SettingRow>
        </SettingsCard>

        <SettingsCard
          title="Active sessions"
          action={
            others.length > 0 && (
              <Button disabled={busy === "all"} onClick={() => void act("all", { action: "end_other_sessions" }, "Signed out of other devices")}>
                Sign out everywhere else
              </Button>
            )
          }
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {account.sessions.map((s) => {
              const device = describeDevice(s.device);
              const Icon = device.mobile ? Smartphone : Laptop;
              const seen = s.current ? "Active now" : s.lastSeenAt ? `Active ${relativeTime(s.lastSeenAt).toLowerCase()}` : `Signed in ${relativeTime(s.createdAt).toLowerCase()}`;
              return (
                <li key={s.id} className="flex items-center gap-3 border-divider py-3 not-first:border-t first:pt-0 last:pb-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-segment text-ink-2">
                    <Icon size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{device.label}</span>
                    <span className="text-[0.8125rem] text-muted">{seen}</span>
                  </span>
                  {s.current ? (
                    <Pill tone="success">This device</Pill>
                  ) : (
                    <Button
                      disabled={busy === s.id}
                      onClick={() => void act(s.id, { action: "end_session", id: s.id }, `Signed out of ${device.label}`)}
                      aria-label={`Sign out of ${device.label}`}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => void fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/login"))}
          >
            <LogOut size={15} aria-hidden />
            Sign out of this device
          </Button>
        </SettingsCard>
      </div>

      <PasswordDialog
        open={changing}
        onOpenChange={setChanging}
        onDone={async () => {
          setChanging(false);
          await reload();
          notify("Password changed. Other devices are signed out.");
        }}
      />
    </div>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError("The two new passwords do not match.");
    setBusy(true);
    setError("");
    try {
      await postJson("/api/account", { action: "change_password", current, next });
      setCurrent("");
      setNext("");
      setConfirm("");
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Change password" description="Other devices will be signed out.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint={`At least ${MIN_PASSWORD} characters.`}
        />
        <Field
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
          hint={mismatch ? "Does not match yet." : undefined}
        />
        {error && (
          <p role="alert" className="m-0 text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={busy || next.length < MIN_PASSWORD || mismatch}>
          {busy ? "Saving…" : "Change password"}
        </Button>
      </form>
    </Dialog>
  );
}
