"use client";

import Link from "next/link";
import { Starburst } from "@/components/landing/site-header";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Clock3,
  FileClock,
  FilePlus2,
  FileText,
  Grid2X2,
  History,
  LayoutList,
  LoaderCircle,
  PanelsTopLeft,
  Search,
  Settings2,
  Star,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { HeaderAuth } from "@/components/header-auth";
import { ModeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { useBoardStore } from "@/store/board.store";
import { toast } from "sonner";
import workspaceStyles from "../workspace/workspace.module.css";
import styles from "./board.module.css";

type BoardSection =
  "documents" | "favorites" | "history" | "settings" | "archive";
type ViewMode = "grid" | "list";

const NAV_ITEMS = [
  { id: "documents", label: "My documents", icon: FileText },
  { id: "favorites", label: "Favorites", icon: Star },
  { id: "history", label: "Version history", icon: History },
  { id: "settings", label: "Writing settings", icon: Settings2 },
  { id: "archive", label: "Archive", icon: Archive },
] satisfies Array<{ id: BoardSection; label: string; icon: typeof FileText }>;

const SECTION_COPY: Record<
  BoardSection,
  { eyebrow: string; title: string; description: string }
> = {
  documents: {
    eyebrow: "Your writing library",
    title: "Documents",
    description: "Find drafts, notes, and finished writing in one place.",
  },
  favorites: {
    eyebrow: "Saved for later",
    title: "Favorites",
    description: "The documents you want close at hand.",
  },
  history: {
    eyebrow: "Recent activity",
    title: "Version history",
    description: "Review the latest changes across your documents.",
  },
  settings: {
    eyebrow: "Writing preferences",
    title: "Writing settings",
    description: "Personalize the way your writing space behaves.",
  },
  archive: {
    eyebrow: "Stored away",
    title: "Archive",
    description: "Documents removed from your active workspace stay here.",
  },
};

export default function BoardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const documents = useBoardStore((state) => state.documents);
  const isLoading = useBoardStore((state) => state.isLoading);
  const isCreating = useBoardStore((state) => state.isCreating);
  const mutatingIds = useBoardStore((state) => state.mutatingIds);
  const error = useBoardStore((state) => state.error);
  const fetchDocuments = useBoardStore((state) => state.fetchDocuments);
  const createDocument = useBoardStore((state) => state.createDocument);
  const setFavorite = useBoardStore((state) => state.setFavorite);
  const setArchived = useBoardStore((state) => state.setArchived);
  const [section, setSection] = useState<BoardSection>("documents");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sortNewest, setSortNewest] = useState(true);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const visibleDocuments = useMemo(() => {
    let filtered = documents.filter((document) =>
      section === "archive" ? document.isArchived : !document.isArchived,
    );
    if (section === "favorites")
      filtered = filtered.filter((document) => document.isFavorite);
    if (query.trim()) {
      const normalized = query.toLowerCase();
      filtered = filtered.filter((document) =>
        document.title.toLowerCase().includes(normalized),
      );
    }
    return sortNewest ? filtered : [...filtered].reverse();
  }, [documents, query, section, sortNewest]);

  const handleCreateDocument = async () => {
    const document = await createDocument();
    if (document) {
      toast.success("Document created");
      router.push(`/board/${document.id}`);
    } else {
      toast.error(
        useBoardStore.getState().error || "Unable to create document",
      );
    }
  };

  const copy = SECTION_COPY[section];
  const isSettings = section === "settings";

  return (
    <div className={`${workspaceStyles.workspacePage} ${styles.boardPage}`}>
      <header className={workspaceStyles.topbar}>
        <Link
          href="/"
          className={workspaceStyles.brand}
          aria-label="Humanizer home"
        >
          <Starburst size={28} />
          <span>
            humanizer<span className={workspaceStyles.brandDot}>.</span>
          </span>
        </Link>
        <nav
          className={workspaceStyles.routeSwitch}
          aria-label="Workspace navigation"
        >
          <Link href="/workspace">
            <PanelsTopLeft size={15} /> Workspace
          </Link>
          <Link href="/board" className={workspaceStyles.activeRoute}>
            <Grid2X2 size={14} /> Board
          </Link>
        </nav>
        <div className={workspaceStyles.topActions}>
          <ModeToggle />
        </div>
      </header>

      <div className={`${workspaceStyles.workspaceBody} ${styles.boardBody}`}>
        <aside
          className={workspaceStyles.serviceRail}
          aria-label="Board sections"
        >
          <div className={workspaceStyles.railHeading}>Library</div>
          <nav className={workspaceStyles.serviceNav}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    section === item.id
                      ? workspaceStyles.activeService
                      : undefined
                  }
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className={workspaceStyles.railAccount}>
            <HeaderAuth compact />
            <div className={workspaceStyles.accountCopy}>
              <strong>{session?.user?.name || "Your account"}</strong>
              <span>{session?.user?.email || "Manage your profile"}</span>
            </div>
          </div>
        </aside>

        <main className={styles.boardContent}>
          <div className={styles.contentInner}>
            <section className={styles.intro}>
              <div>
                <span className={workspaceStyles.eyebrow}>{copy.eyebrow}</span>
                <h1>{copy.title}</h1>
                <p>{copy.description}</p>
              </div>
              {!isSettings && section !== "archive" && (
                <div className={styles.primaryActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => toast.info("Document upload is coming soon")}
                  >
                    <Upload size={16} /> Upload
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleCreateDocument()}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <LoaderCircle size={17} className={styles.spinner} />
                    ) : (
                      <FilePlus2 size={17} />
                    )}{" "}
                    {isCreating ? "Creating..." : "New document"}
                  </button>
                </div>
              )}
            </section>

            {isSettings ? (
              <section className={styles.settingsPanel}>
                <div>
                  <h2>Writing defaults</h2>
                  <p>
                    These controls are visual placeholders for the future
                    settings flow.
                  </p>
                </div>
                <label htmlFor="smart-suggestions-checkbox" className={styles.settingRow}>
                  <span>
                    <strong>Smart suggestions</strong>
                    <small>Show writing recommendations while editing.</small>
                  </span>
                  <input
                    id="smart-suggestions-checkbox"
                    type="checkbox"
                    defaultChecked
                    aria-label="Smart suggestions"
                  />
                </label>
                <label htmlFor="auto-save-drafts-checkbox" className={styles.settingRow}>
                  <span>
                    <strong>Auto-save drafts</strong>
                    <small>Keep changes locally while you write.</small>
                  </span>
                  <input
                    id="auto-save-drafts-checkbox"
                    type="checkbox"
                    defaultChecked
                    aria-label="Auto-save drafts"
                  />
                </label>
              </section>
            ) : (
              <>
                <section
                  className={styles.toolbar}
                  aria-label="Document controls"
                >
                  <label className={styles.searchBox}>
                    <Search size={18} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search documents"
                      aria-label="Search documents"
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => setSortNewest((current) => !current)}
                  >
                    <ArrowUpDown size={15} />
                    {sortNewest ? "Recently edited" : "Oldest first"}
                  </button>
                  <div className={styles.viewSwitch} aria-label="Document view">
                    <button
                      type="button"
                      className={
                        view === "list" ? styles.activeView : undefined
                      }
                      onClick={() => setView("list")}
                      aria-label="List view"
                    >
                      <LayoutList size={17} />
                    </button>
                    <button
                      type="button"
                      className={
                        view === "grid" ? styles.activeView : undefined
                      }
                      onClick={() => setView("grid")}
                      aria-label="Grid view"
                    >
                      <Grid2X2 size={16} />
                    </button>
                  </div>
                </section>

                <section>
                  <div className={styles.sectionLabel}>
                    <h2>
                      {section === "history"
                        ? "Recent changes"
                        : section === "archive"
                          ? "Archived"
                          : "Today"}
                    </h2>
                    <span>
                      {visibleDocuments.length}{" "}
                      {visibleDocuments.length === 1 ? "document" : "documents"}
                    </span>
                  </div>
                  {isLoading ? (
                    <div className={styles.emptyState}>
                      <LoaderCircle size={24} className={styles.spinner} />
                      <h3>Loading documents</h3>
                    </div>
                  ) : visibleDocuments.length ? (
                    <div
                      className={`${styles.documentGrid} ${view === "list" ? styles.listView : ""}`}
                    >
                      {visibleDocuments.map((document) => (
                        <div
                          className={styles.documentCard}
                          key={document.id}
                          role="link"
                          tabIndex={0}
                          aria-label={`Open ${document.title}`}
                          onClick={() => router.push(`/board/${document.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(`/board/${document.id}`);
                            }
                          }}
                        >
                          <div className={styles.cardTop}>
                            <span className={styles.fileIcon}>
                              <FileText size={19} />
                            </span>
                            <div className={styles.cardActions}>
                              <button
                                type="button"
                                disabled={mutatingIds.includes(document.id)}
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const nextValue = !document.isFavorite;
                                  const updated = await setFavorite(
                                    document.id,
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
                                }}
                                onKeyDown={(event) => event.stopPropagation()}
                                aria-label={
                                  document.isFavorite
                                    ? "Remove favorite"
                                    : "Add favorite"
                                }
                              >
                                <Star
                                  size={17}
                                  fill={
                                    document.isFavorite
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <button
                                type="button"
                                disabled={mutatingIds.includes(document.id)}
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  const nextValue = !document.isArchived;
                                  const updated = await setArchived(
                                    document.id,
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
                                }}
                                onKeyDown={(event) => event.stopPropagation()}
                                aria-label={
                                  document.isArchived
                                    ? "Restore document"
                                    : "Archive document"
                                }
                              >
                                {document.isArchived ? (
                                  <ArchiveRestore size={17} />
                                ) : (
                                  <Archive size={17} />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className={styles.cardCopy}>
                            <h3>{document.title}</h3>
                            <p>
                              {document.wordCount
                                ? `${document.wordCount.toLocaleString()} words`
                                : "Empty document"}
                            </p>
                          </div>
                          <div className={styles.cardMeta}>
                            {section === "history" ? (
                              <FileClock size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                            <span>
                              {new Date(document.updatedAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <Archive size={24} />
                      <h3>No documents here</h3>
                      <p>
                        {query
                          ? "Try a different search."
                          : "Documents will appear here when they are available."}
                      </p>
                    </div>
                  )}
                </section>
                {error && (
                  <p className={styles.errorMessage} role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
