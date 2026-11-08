"use client";

import type { JSONContent } from "@tiptap/core";
import { Starburst } from "@/components/landing/site-header";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleAlert,
  Cloud,
  ArrowLeft,
  FileText,
  LoaderCircle,
  MoreHorizontal,
  Sparkles,
  Star,
  Archive,
} from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle";
import { RichTextEditor } from "@/components/document/rich-text-editor";
import {
  DocumentToolPanel,
  type DocumentToolHistoryItem,
} from "@/components/document/document-tool-panel";
import {
  EMPTY_TIPTAP_DOCUMENT,
  plainTextToTiptapDocument,
} from "@/components/document/tiptap-extensions";
import {
  createDefaultToolRequest,
  getToolDefinition,
  getToolOutputText,
  type ToolId,
} from "@/lib/tool-registry";
import { useBoardStore } from "@/store/board.store";
import { useToolStore } from "@/store/workspace.store";
import { toast } from "sonner";
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
  const fetchDocumentToolHistory = useBoardStore(
    (state) => state.fetchDocumentToolHistory,
  );
  const deleteDocumentToolHistory = useBoardStore(
    (state) => state.deleteDocumentToolHistory,
  );
  const setFavorite = useBoardStore((state) => state.setFavorite);
  const setArchived = useBoardStore((state) => state.setArchived);
  const mutatingIds = useBoardStore((state) => state.mutatingIds);
  const [title, setTitle] = useState("");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolHistory, setToolHistory] = useState<DocumentToolHistoryItem[]>([]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorDraft, setEditorDraft] = useState<{
    content: JSONContent;
    plainText: string;
    wordCount: number;
    characterCount: number;
  } | null>(null);
  const hydratedDocumentId = useRef<string | null>(null);
  const changeSequence = useRef(0);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreMenuOpen]);

  const runSelectionTool = useCallback(
    async (service: ToolId, input: string) => {
      setToolsOpen(true);
      const result = await useToolStore.getState().runTool({
        ...createDefaultToolRequest(service, input),
        documentId: docId,
        inputSource: "selection",
      });
      const definition = getToolDefinition(service);
      const output = result
        ? getToolOutputText(definition, result) || "Analysis completed."
        : useToolStore.getState().error || `Unable to run ${definition.label}.`;

      setToolHistory((history) => [
        ...history,
        {
          id: crypto.randomUUID(),
          service,
          input,
          output,
          source: "selection",
          createdAt: new Date(),
          failed: !result,
        },
      ]);
      if (result) toast.success(`${definition.label} completed`);
      else toast.error(output);
    },
    [docId],
  );

  const applyToolOutput = useCallback((output: string) => {
    const plainText = output.trim();
    const words = plainText ? plainText.split(/\s+/).length : 0;
    setEditorDraft({
      content: plainTextToTiptapDocument(plainText),
      plainText,
      wordCount: words,
      characterCount: plainText.length,
    });
    changeSequence.current += 1;
    setHasLocalChanges(true);
    setEditorRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (docId) void fetchDocument(docId);
  }, [docId, fetchDocument]);

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    void fetchDocumentToolHistory(docId).then((jobs) => {
      if (cancelled) return;
      setToolHistory(
        jobs.map((job) => ({
          ...job,
          createdAt: new Date(job.createdAt),
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [docId, fetchDocumentToolHistory]);

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
        toast.error(
          useBoardStore.getState().saveError || "Unable to save document",
        );
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
            <Starburst size={25} />
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
          <button
            type="button"
            className={styles.toolsButton}
            onClick={() => setToolsOpen((open) => !open)}
            aria-expanded={toolsOpen}
            aria-controls="document-tools"
          >
            <Sparkles size={15} />
            <span>Writing tools</span>
          </button>
          <div className={styles.themeControl}>
            <ModeToggle />
          </div>
          <div className={styles.moreMenu} ref={moreMenuRef}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} />
            </button>
            {moreMenuOpen && activeDocument && (
              <div className={styles.moreDropdown} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={mutatingIds.includes(activeDocument.id)}
                  onClick={async () => {
                    const nextValue = !activeDocument.isFavorite;
                    const updated = await setFavorite(
                      activeDocument.id,
                      nextValue,
                    );
                    if (updated) {
                      toast.success(
                        nextValue
                          ? "Added to favorites"
                          : "Removed from favorites",
                      );
                    } else {
                      toast.error(
                        useBoardStore.getState().error ||
                          "Unable to update favorite",
                      );
                    }
                    setMoreMenuOpen(false);
                  }}
                >
                  <Star
                    size={15}
                    fill={activeDocument.isFavorite ? "currentColor" : "none"}
                  />
                  {activeDocument.isFavorite
                    ? "Remove from favorites"
                    : "Add to favorites"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={mutatingIds.includes(activeDocument.id)}
                  onClick={async () => {
                    const nextValue = !activeDocument.isArchived;
                    const updated = await setArchived(
                      activeDocument.id,
                      nextValue,
                    );
                    if (updated) {
                      toast.success(
                        nextValue
                          ? "Document moved to archive"
                          : "Document restored",
                      );
                    } else {
                      toast.error(
                        useBoardStore.getState().error ||
                          "Unable to update archive",
                      );
                    }
                    setMoreMenuOpen(false);
                  }}
                >
                  <Archive size={15} />
                  {activeDocument.isArchived
                    ? "Restore from archive"
                    : "Move to archive"}
                </button>
              </div>
            )}
          </div>
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
            key={`${activeDocument.id}-${editorRevision}`}
            content={
              (editorDraft?.content ||
                activeDocument.content ||
                EMPTY_TIPTAP_DOCUMENT) as JSONContent
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
            onRunSelectionTool={runSelectionTool}
          />
        ) : null}
      </main>
      <div id="document-tools">
        <DocumentToolPanel
          open={toolsOpen}
          documentId={docId}
          documentText={
            editorDraft?.plainText || activeDocument?.plainText || ""
          }
          onClose={() => setToolsOpen(false)}
          history={toolHistory}
          onHistoryChange={setToolHistory}
          onClearHistory={async () => {
            const deleted = await deleteDocumentToolHistory(docId);
            if (deleted) {
              setToolHistory([]);
              toast.success("Tool history deleted");
            } else {
              toast.error(
                useBoardStore.getState().error ||
                  "Unable to delete tool history",
              );
            }
          }}
          onApplyOutput={applyToolOutput}
        />
      </div>
    </div>
  );
}
