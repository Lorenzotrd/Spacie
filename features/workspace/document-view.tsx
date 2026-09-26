"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

/**
 * Read-only document rendering. Content goes through the editor schema, which drops
 * any markup it does not know (scripts, handlers, iframes), so it is safe to show
 * documents written by anyone, including agents, to anonymous visitors.
 */
export function DocumentView({ content }: { content: string }) {
  const editor = useEditor(
    {
      extensions: [StarterKit.configure({ link: { openOnClick: true } }), TaskList, TaskItem.configure({ nested: true })],
      content,
      editable: false,
      immediatelyRender: false,
    },
    [content],
  );
  if (!editor) return <div className="empty-state">Opening document…</div>;
  return <EditorContent editor={editor} className="document-body read-only" />;
}
