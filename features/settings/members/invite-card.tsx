"use client";
import { forwardRef, useState, type FormEvent } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/components/ui/code-block";
import { postJson } from "../api";
import { SettingsCard } from "../parts";
import { RoleSelect, type EditableRole } from "./role-select";

type Created = { email: string | null; link: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates single-use join links, one per address (or one open link). Nothing is emailed. */
export const InviteCard = forwardRef<HTMLInputElement, {
  isOwner: boolean;
  onInvited: () => Promise<void>;
  notify: (m: string) => void;
  fail: (m: string) => void;
}>(function InviteCard({ isOwner, onInvited, notify, fail }, ref) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<EditableRole>("member");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);

  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const invalid = list.filter((e) => !EMAIL.test(e));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid.length) return fail(`Check this address: ${invalid[0]}`);
    setBusy(true);
    try {
      const targets = list.length ? list : [null];
      const links: Created[] = [];
      for (const email of targets) {
        const { link } = await postJson<{ link: string }>("/api/invite", { email: email ?? "", role });
        links.push({ email, link });
      }
      setCreated(links);
      setEmails("");
      await onInvited();
      if (links.length === 1) {
        await copyText(links[0].link).then(() => notify("Invite link created and copied"), () => notify("Invite link created"));
      } else notify(`${links.length} invite links created`);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Invite people">
      <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Email addresses</span>
          <input
            ref={ref}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="name@company.com, another@company.com"
            autoComplete="off"
            aria-invalid={invalid.length > 0}
            className="h-[42px] rounded-control border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-[#a3a5ac] focus:border-accent aria-invalid:border-danger-border"
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:w-[150px]">
          <span className="text-[13px] font-medium text-ink-2">Role</span>
          <RoleSelect value={role} onChange={setRole} allowAdmin={isOwner} label="Role for the invitation" className="h-[42px]" />
        </label>
        <Button type="submit" variant="primary" disabled={busy} className="h-[42px] px-4">
          {busy ? "Creating…" : list.length > 1 ? `Create ${list.length} links` : "Create invite link"}
        </Button>
      </form>
      <p className="m-0 text-[13px] leading-normal text-muted">
        Each link works once and expires in 7 days. Spacie does not send email: share the link yourself. Leave the address
        empty for a link anyone can use once.
      </p>
      {created.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {created.map((c) => (
            <li key={c.link} className="flex items-center gap-3 rounded-xl bg-subtle py-2 pr-2 pl-3.5">
              <Link2 size={16} className="shrink-0 text-accent" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[12.5px] text-ink-2">{c.link.replace(/^https?:\/\//, "")}</span>
                <span className="text-xs text-muted">{c.email ?? "Anyone with the link"}</span>
              </span>
              <Button
                size="sm"
                className="h-9"
                aria-label={`Copy invite link${c.email ? ` for ${c.email}` : ""}`}
                onClick={() => void copyText(c.link).then(() => notify("Invite link copied"), () => fail("Copy failed. Select the link and copy it by hand."))}
              >
                <Copy size={14} aria-hidden />
                Copy
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
});
