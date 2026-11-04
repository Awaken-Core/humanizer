"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  createDocumentExtensions,
  EMPTY_TIPTAP_DOCUMENT,
} from "./tiptap-extensions";
import styles from "./rich-document.module.css";

export function RichTextRenderer({
  content,
  className = "",
}: {
  content?: JSONContent | null;
  className?: string;
}) {
  const editor = useEditor(
    {
      extensions: createDocumentExtensions(false),
      content: content || EMPTY_TIPTAP_DOCUMENT,
      editable: false,
      immediatelyRender: false,
    },
    [content],
  );

  if (!editor) return null;
  return (
    <EditorContent
      editor={editor}
      className={`${styles.renderedContent} ${className}`}
    />
  );
}
