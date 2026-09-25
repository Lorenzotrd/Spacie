"use client";
import { useState } from "react";
import {
  ArrowUp,
  Check,
  MessageSquare,
  ThumbsUp,
  History,
  X,
} from "lucide-react";
import type { PublicState, FileRecord } from "@/lib/types";
import type { Command } from "@/lib/service";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
export function ActivityFeed({
  state,
  fileId,
  projectId,
}: {
  state: PublicState;
  fileId?: string;
  projectId?: string;
}) {
  const events = state.activity.filter((a) =>
    fileId ? a.fileId === fileId : projectId ? a.projectId === projectId : true,
  );
  return (
    <>
      <div className="right-section-label">
        RECENT ACTIVITY <span>{events.length} updates</span>
      </div>
      {events.map((a) => (
        <div className="activity-item" key={a.id}>
          <Avatar
            person={state.principals.find((x) => x.id === a.actorId)}
            small
          />
          <div>
            <strong>
              {state.principals.find((x) => x.id === a.actorId)?.name}
            </strong>
            {state.principals.find((x) => x.id === a.actorId)?.type ===
              "agent" && <span className="ai-label">AI</span>}
            <p>
              {a.action} <b>{a.name}</b>
            </p>
            <small>
              {new Date(a.createdAt).toLocaleString("en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </small>
          </div>
        </div>
      ))}
      {!events.length && (
        <div className="empty-state">
          A fresh start. Activity will appear here.
        </div>
      )}
      <div className="activity-end">
        <i />
        You’re all caught up
      </div>
    </>
  );
}
export function CollaborationPanel({
  state,
  file,
  projectId,
  tab,
  setTab,
  mutate,
  onClose,
}: {
  state: PublicState;
  file?: FileRecord;
  projectId: string;
  tab: string;
  setTab: (tab: string) => void;
  mutate: (c: Command) => Promise<unknown>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const comments = state.comments.filter((c) => c.fileId === file?.id);
  const versions = state.versions
    .filter((v) => v.fileId === file?.id)
    .sort((a, b) => b.number - a.number);
  async function post() {
    if (!file || !text.trim()) return;
    try {
      await mutate({
        action: "create_comment",
        id: file.id,
        content: text,
        parentId: reply,
      });
      setText("");
      setReply(null);
    } catch {}
  }
  return (
    <aside className="right-panel">
      <div className="right-title">
        <span>{file ? "In this file" : "In this space"}</span>
        <button aria-label="Close collaboration panel" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="right-tabs">
        {["Comments", "Activity", "Versions"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={t === tab ? "active" : ""}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="right-content">
        {tab === "Activity" ? (
          <ActivityFeed state={state} fileId={file?.id} projectId={projectId} />
        ) : !file ? (
          <div className="empty-state">
            <MessageSquare size={27} />
            <strong>A little context goes a long way.</strong>
            <p>Open a file to see its comments and versions.</p>
          </div>
        ) : tab === "Comments" ? (
          <>
            {comments.map((c) => (
              <div
                className={`comment ${c.parentId ? "reply" : ""} ${c.resolved ? "resolved" : ""}`}
                key={c.id}
              >
                <div className="comment-author">
                  <Avatar
                    small
                    person={state.principals.find((p) => p.id === c.actorId)}
                  />
                  <strong>
                    {state.principals.find((p) => p.id === c.actorId)?.name}
                  </strong>
                  {c.resolved && <Check size={13} />}
                </div>
                <p>{c.content}</p>
                <div className="comment-actions">
                  <button onClick={() => setReply(c.id)}>Reply</button>
                  <button
                    aria-label="Like comment"
                    onClick={() =>
                      void mutate({ action: "react_comment", id: c.id }).catch(
                        () => undefined,
                      )
                    }
                  >
                    <ThumbsUp size={12} />
                    {c.reactions.length || ""}
                  </button>
                  <button
                    onClick={() =>
                      void mutate({
                        action: "resolve_comment",
                        id: c.id,
                      }).catch(() => undefined)
                    }
                  >
                    {c.resolved ? "Reopen" : "Resolve"}
                  </button>
                </div>
              </div>
            ))}
            {!comments.length && (
              <div className="empty-state">Start the conversation.</div>
            )}
          </>
        ) : (
          versions.map((v) => (
            <div className="version-item" key={v.id}>
              <span className="version-number">
                <History size={16} />
                Version {v.number}
                {v.number === file.version && <em>Current</em>}
              </span>
              <p>
                {state.principals.find((p) => p.id === v.actorId)?.name} ·{" "}
                {new Date(v.createdAt).toLocaleDateString()}
              </p>
              <small>{v.message}</small>
              <div>
                <button onClick={() => setPreview(v.number)}>
                  Preview & compare
                </button>
                {v.number !== file.version && (
                  <button
                    onClick={() =>
                      void mutate({
                        action: "restore_version",
                        id: file.id,
                        version: v.number,
                      }).catch(() => undefined)
                    }
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {tab === "Comments" && file && (
        <div className="comment-compose">
          {reply && (
            <button onClick={() => setReply(null)}>
              Replying in thread <X size={12} />
            </button>
          )}
          <textarea
            aria-label="Write a comment"
            placeholder="Share a thought…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div>
            <span>Be kind. Build together.</span>
            <button
              className="button primary"
              disabled={!text.trim()}
              aria-label="Post comment"
              onClick={() => void post()}
            >
              <ArrowUp size={15} />
            </button>
          </div>
        </div>
      )}
      <div className="right-bottom">
        <span className="agent-glow">✳</span>
        <div>
          <strong>Built for working together</strong>
          <p>Humans and AI. One shared space.</p>
        </div>
      </div>
      <Dialog
        open={preview !== null}
        onOpenChange={() => setPreview(null)}
        title={`Version ${preview}`}
        description="Compare this snapshot with the current version."
      >
        <div className="version-compare">
          <span>
            Selected:{" "}
            {versions.find((v) => v.number === preview)?.content.length ?? 0}{" "}
            characters
          </span>
          <span>Current: {file?.content.length ?? 0} characters</span>
        </div>
        <pre className="version-preview">
          {versions
            .find((v) => v.number === preview)
            ?.content.replace(/<[^>]+>/g, "\n") ||
            "Binary asset snapshot. Download the asset from its file view."}
        </pre>
      </Dialog>
    </aside>
  );
}
