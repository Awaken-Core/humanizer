"use client";

import type { JSONContent } from "@tiptap/core";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Cloud,
  ArrowLeft,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle";
import { RichTextEditor } from "@/components/document/rich-text-editor";
import { EMPTY_TIPTAP_DOCUMENT } from "@/components/document/tiptap-extensions";
import { useBoardStore } from "@/store/board.store";
import workspaceStyles from "../../workspace/workspace.module.css";
import styles from "./document.module.css";

export default function DocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  const activeDocument = useBoardStore((state) => state.activeDocument);
  const isLoading = useBoardStore((state) => state.isLoading);
  const isSaving = useBoardStore((state) => state.isSaving);
  const error = useBoardStore((state) => state.error);
  const saveError = useBoardStore((state) => state.saveError);
  const fetchDocument = useBoardStore((state) => state.fetchDocument);
  const saveDocument = useBoardStore((state) => state.saveDocument);
  const [title, setTitle] = useState("");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [editorDraft, setEditorDraft] = useState<{
    content: JSONContent;
    plainText: string;
    wordCount: number;
    characterCount: number;
  } | null>(null);
  const hydratedDocumentId = useRef<string | null>(null);
  const changeSequence = useRef(0);

  useEffect(() => {
    if (docId) void fetchDocument(docId);
  }, [docId, fetchDocument]);

  useEffect(() => {
    if (activeDocument && hydratedDocumentId.current !== activeDocument.id) {
      hydratedDocumentId.current = activeDocument.id;
      setTitle(activeDocument.title);
      setEditorDraft({
        content: (activeDocument.content ||
          EMPTY_TIPTAP_DOCUMENT) as JSONContent,
        plainText: activeDocument.plainText || "",
        wordCount: activeDocument.wordCount || 0,
        characterCount: activeDocument.characterCount || 0,
      });
      setHasLocalChanges(false);
    }
  }, [activeDocument]);

  useEffect(() => {
    if (!activeDocument || !editorDraft || !hasLocalChanges || isSaving) {
      return;
    }

    const sequenceAtSchedule = changeSequence.current;
    const timeout = window.setTimeout(async () => {
      const saved = await saveDocument(activeDocument.id, {
        title: title.trim() || "Untitled document",
        content: editorDraft.content as Record<string, unknown>,
        plainText: editorDraft.plainText,
        wordCount: editorDraft.wordCount,
        characterCount: editorDraft.characterCount,
        expectedVersion: activeDocument.latestVersion,
      });

      if (saved && sequenceAtSchedule === changeSequence.current) {
        setHasLocalChanges(false);
      } else if (!saved && sequenceAtSchedule === changeSequence.current) {
        // Keep the error visible, but do not retry the same failed payload forever.
        setHasLocalChanges(false);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [
    activeDocument,
    editorDraft,
    hasLocalChanges,
    isSaving,
    saveDocument,
    title,
  ]);

  return (
    <div className={`${workspaceStyles.workspacePage} ${styles.documentPage}`}>
      <header className={styles.documentHeader}>
        <div className={styles.headerStart}>
          <Link
            href="/board"
            className={styles.iconButton}
            aria-label="Back to board"
          >
            <ArrowLeft size={17} />
          </Link>
          <Link
            href="/"
            className={styles.brandMark}
            aria-label="Humanizer home"
          >
            <Image
              alt=""
              src="/image/logo.svg"
              height={25}
              width={25}
              className={workspaceStyles.brandLogo}
            />
          </Link>
          <span className={styles.divider} />
          <FileText size={17} className={styles.documentIcon} />
          <input
            className={styles.titleInput}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              changeSequence.current += 1;
              setHasLocalChanges(true);
            }}
            placeholder="Untitled document"
            aria-label="Document title"
          />
        </div>
        <div className={styles.headerActions}>
          <span className={styles.saveStatus}>
            {saveError ? <CircleAlert size={14} /> : <Cloud size={14} />}
            {saveError
              ? "Save failed"
              : isSaving
                ? "Saving…"
                : hasLocalChanges
                  ? "Unsaved changes"
                  : "Saved"}
          </span>
          <ModeToggle />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <main className={styles.documentMain}>
        {isLoading ? (
          <div className={styles.stateMessage}>
            <LoaderCircle className={styles.spinner} size={24} />
            <span>Opening document…</span>
          </div>
        ) : error ? (
          <div className={styles.stateMessage}>
            <strong>Unable to open document</strong>
            <span>{error}</span>
            <Link href="/board">Return to board</Link>
          </div>
        ) : activeDocument ? (
          <RichTextEditor
            content={
              (activeDocument.content || EMPTY_TIPTAP_DOCUMENT) as JSONContent
            }
            onChange={({ json, text, words, characters }) => {
              setEditorDraft({
                content: json,
                plainText: text,
                wordCount: words,
                characterCount: characters,
              });
              changeSequence.current += 1;
              setHasLocalChanges(true);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
