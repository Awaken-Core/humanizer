"use client";

import { useMemo, useState } from "react";
import { Check, Copy, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";
import {
  createDefaultToolRequest,
  getToolDefinition,
  getToolOutputText,
  getToolsForContext,
  type ToolId,
} from "@/lib/tool-registry";
import { useToolStore } from "@/store/workspace.store";
import { toast } from "sonner";
import { DOCUMENT_TOOL_ICONS } from "./document-tool-icons";
import styles from "./document-tool-panel.module.css";

export interface DocumentToolHistoryItem {
  id: string;
  service: ToolId;
  input: string;
  output: string;
  source: "document" | "selection";
  createdAt: Date;
  failed?: boolean;
}

interface DocumentToolPanelProps {
  open: boolean;
  documentId: string;
  documentText: string;
  onClose: () => void;
  history: DocumentToolHistoryItem[];
  onHistoryChange: (history: DocumentToolHistoryItem[]) => void;
  onClearHistory: () => Promise<void>;
  onApplyOutput: (output: string) => void;
}

export function DocumentToolPanel({
  open,
  documentId,
  documentText,
  onClose,
  history,
  onHistoryChange,
  onClearHistory,
  onApplyOutput,
}: DocumentToolPanelProps) {
  const tools = useMemo(() => getToolsForContext("document"), []);
  const runTool = useToolStore((state) => state.runTool);
  const isLoading = useToolStore((state) => state.isLoading);
  const [runningTool, setRunningTool] = useState<ToolId | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const newestItem = history.at(-1);
  const canApplyNewest =
    newestItem &&
    !newestItem.failed &&
    (["humanizer", "summarizer", "paraphraser"] as ToolId[]).includes(
      newestItem.service,
    );

  const copyOutput = async (item: DocumentToolHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.output);
      setCopiedId(item.id);
      toast.success("Response copied");
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      toast.error("Unable to copy the response");
    }
  };

  const run = async (service: ToolId) => {
    const input = documentText.trim();
    if (!input || isLoading) return;

    setRunningTool(service);
    const result = await runTool({
      ...createDefaultToolRequest(service, input),
      documentId,
      inputSource: "document",
    });
    const definition = getToolDefinition(service);
    const error = useToolStore.getState().error;
    const output = result
      ? getToolOutputText(definition, result) || "Analysis completed."
      : error || `Unable to run ${definition.label}.`;

    onHistoryChange([
      ...history,
      {
        id: crypto.randomUUID(),
        service,
        input,
        output,
        source: "document",
        createdAt: new Date(),
        failed: !result,
      },
    ]);
    if (result) toast.success(`${definition.label} completed`);
    else toast.error(output);
    setRunningTool(null);
  };

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : styles.panelClosed}`}
      aria-label="Document AI tools"
      aria-hidden={!open}
      inert={!open}
    >
      <header className={styles.panelHeader}>
        <button type="button" onClick={onClose} aria-label="Close tools">
          <X size={18} />
        </button>
        <div className={styles.panelTitle}>
          <span>
            <Sparkles size={17} />
          </span>
          <div>
            <strong>Writing tools</strong>
            <small>Run a tool on this document</small>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            setIsClearing(true);
            await onClearHistory();
            setIsClearing(false);
          }}
          aria-label="Clear tool history"
          disabled={history.length === 0 || isClearing}
        >
          {isClearing ? (
            <LoaderCircle className={styles.spinner} size={17} />
          ) : (
            <Trash2 size={17} />
          )}
        </button>
      </header>

      <div className={styles.panelBody}>
        {history.length > 0 && (
          <section className={styles.timeline} aria-label="Tool history">
            {history.map((item) => {
              const tool = getToolDefinition(item.service);
              return (
                <article key={item.id} className={styles.historyItem}>
                  <div className={styles.historyMeta}>
                    <strong>{tool.label}</strong>
                    <span>
                      {item.source === "selection" ? "Selection" : "Document"}
                    </span>
                  </div>
                  <div className={styles.messageInput} title={item.input}>
                    <p>{item.input}</p>
                  </div>
                  <div
                    className={`${styles.messageOutput} ${item.failed ? styles.failed : ""}`}
                  >
                    {item.output}
                  </div>
                  {!item.failed && (
                    <div className={styles.responseActions}>
                      <button
                        type="button"
                        onClick={() => void copyOutput(item)}
                      >
                        {copiedId === item.id ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}
                        {copiedId === item.id ? "Copied" : "Copy"}
                      </button>
                      {canApplyNewest && newestItem.id === item.id && (
                        <button
                          type="button"
                          className={styles.applyButton}
                          onClick={() => {
                            onApplyOutput(item.output);
                            toast.success("Response applied to document");
                          }}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <section className={styles.toolsSection}>
          <div className={styles.sectionHeading}>
            <Sparkles size={16} />
            <strong>Use a writing tool</strong>
          </div>
          <div className={styles.toolList}>
            {tools.map((tool) => {
              const ToolIcon = DOCUMENT_TOOL_ICONS[tool.id];
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => void run(tool.id)}
                  disabled={!documentText.trim() || isLoading}
                  aria-label={tool.label}
                  data-tooltip={tool.label}
                >
                  <span className={styles.toolIcon}>
                    {runningTool === tool.id ? (
                      <LoaderCircle className={styles.spinner} size={16} />
                    ) : (
                      <ToolIcon size={15} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
