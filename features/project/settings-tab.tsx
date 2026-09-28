"use client";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Controller } from "@/features/workspace/use-controller";

const MAX = 10_000;

/** The project's instructions for AI: context every agent reads before it acts. Admins edit it. */
export function SettingsTab({ ctl }: { ctl: Controller }) {
  const saved = ctl.currentProject?.instructions ?? "";
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const canEdit = ctl.me?.role === "owner" || ctl.me?.role === "admin";
  useEffect(() => setDraft(saved), [saved, ctl.project]);
  const dirty = draft.trim() !== saved;

  const save = async () => {
    setSaving(true);
    try {
      await ctl.mutate({ action: "update_project", projectId: ctl.project, instructions: draft });
      ctl.setNotice("Instructions saved");
    } catch {
      // mutate already surfaced the error.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="m-0 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <FileText size={17} strokeWidth={1.8} className="text-accent" aria-hidden />
        Instructions for AI
      </h2>
      <p className="text-[0.8125rem] text-muted">
        Project context every agent reads before it acts. Agents get it with the project over MCP.
      </p>
      {canEdit ? (
        <>
          <textarea
            aria-label="Instructions for AI"
            value={draft}
            maxLength={MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Keep the audit deck in French, cite every number in the sources doc, and never overwrite a version without saying why."
            className="min-h-[7.5rem] resize-y rounded-[0.625rem] border border-[#eceae4] bg-subtle p-3.5 text-[0.8125rem] leading-relaxed text-ink-2 outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              {draft.length.toLocaleString("en")} / {MAX.toLocaleString("en")}
            </span>
            <div className="ml-auto flex gap-2">
              {dirty && <Button onClick={() => setDraft(saved)} disabled={saving}>Discard</Button>}
              <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-[7.5rem] rounded-[0.625rem] border border-[#eceae4] bg-subtle p-3.5 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-ink-2">
          {saved || <span className="text-muted">No instructions yet. A workspace admin can add them.</span>}
        </div>
      )}
    </Card>
  );
}
