"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  List,
  Heading2,
  Quote,
  Code,
  CheckSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
export function DocumentEditor({
  content,
  onSave,
  editable = true,
}: {
  content: string;
  onSave: (html: string) => Promise<void>;
  editable?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    save = useRef(onSave),
    pending = useRef<string | null>(null),
    saving = useRef(false),
    lastContent = useRef(content);
  const [status, setStatus] = useState("Saved");
  useEffect(() => {
    save.current = onSave;
  }, [onSave]);
  const flush = useRef(async () => {});
  useEffect(() => {
    flush.current = async () => {
      if (pending.current === null || saving.current) return;
      const html = pending.current;
      pending.current = null;
      saving.current = true;
      setStatus("Saving…");
      try {
        await save.current(html);
        lastContent.current = html;
        setStatus("Saved");
      } catch {
        pending.current = html;
        setStatus("Save failed — copy your changes before closing");
      } finally {
        saving.current = false;
      }
    };
  }, []);
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      pending.current = editor.getHTML();
      setStatus("Unsaved changes");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush.current(), 900);
    },
    onBlur: () => void flush.current(),
  });
  useEffect(() => {
    if (
      content !== lastContent.current &&
      pending.current === null &&
      !saving.current &&
      editor
    ) {
      editor.commands.setContent(content, { emitUpdate: false });
      lastContent.current = content;
    }
  }, [content, editor]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current !== null || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
      void flush.current();
    };
  }, []);
  if (!editor) return <div className="empty-state">Opening document…</div>;
  return (
    <>
      <div className="editor-toolbar">
        <button
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </button>
        <button
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </button>
        <button
          aria-label="Heading"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={17} />
        </button>
        <button
          aria-label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </button>
        <button
          aria-label="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={15} />
        </button>
        <button
          aria-label="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code size={16} />
        </button>
        <button
          aria-label="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckSquare size={16} />
        </button>
        <span>{status}</span>
      </div>
      <EditorContent editor={editor} className="document-body" />
    </>
  );
}
