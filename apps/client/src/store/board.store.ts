import { create } from "zustand";
import type { ToolId } from "@/lib/tool-registry";
import { getApiErrorMessage } from "@/lib/api.dto";
import { DocumentApiResponseDto } from "@/features/documents/document.dto";

export interface DocumentToolHistoryRecord {
  id: string;
  service: ToolId;
  input: string;
  output: string;
  source: "document" | "selection";
  createdAt: string;
  failed?: boolean;
}

export interface BoardDocument {
  id: string;
  title: string;
  latestVersion: number;
  wordCount: number;
  characterCount: number;
  content: Record<string, unknown>;
  plainText: string;
  contentSchemaVersion: number;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDocumentInput {
  title: string;
  content: Record<string, unknown>;
  plainText: string;
  wordCount: number;
  characterCount: number;
  expectedVersion: number;
}

interface DocumentApiResponse {
  success?: boolean;
  data?: {
    document?: BoardDocument;
    documents?: BoardDocument[];
    jobs?: DocumentToolHistoryRecord[];
  };
  error?: { message?: string } | string;
}

interface BoardStore {
  documents: BoardDocument[];
  activeDocument: BoardDocument | null;
  isLoading: boolean;
  isCreating: boolean;
  isSaving: boolean;
  mutatingIds: string[];
  error: string | null;
  saveError: string | null;
  fetchDocuments: () => Promise<void>;
  fetchDocument: (documentId: string) => Promise<BoardDocument | null>;
  createDocument: (title?: string) => Promise<BoardDocument | null>;
  saveDocument: (
    documentId: string,
    input: SaveDocumentInput,
  ) => Promise<BoardDocument | null>;
  fetchDocumentToolHistory: (
    documentId: string,
  ) => Promise<DocumentToolHistoryRecord[]>;
  deleteDocumentToolHistory: (documentId: string) => Promise<boolean>;
  setFavorite: (documentId: string, isFavorite: boolean) => Promise<boolean>;
  setArchived: (documentId: string, isArchived: boolean) => Promise<boolean>;
  clearError: () => void;
}

function getErrorMessage(payload: DocumentApiResponse, fallback: string) {
  return getApiErrorMessage(payload.error, fallback);
}

async function readResponse(response: Response): Promise<DocumentApiResponse> {
  try {
    return DocumentApiResponseDto.parse(await response.json());
  } catch {
    return {};
  }
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  documents: [],
  activeDocument: null,
  isLoading: false,
  isCreating: false,
  isSaving: false,
  mutatingIds: [],
  error: null,
  saveError: null,

  fetchDocuments: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const response = await fetch("/api/v1/documents", { method: "GET" });
      const payload = await readResponse(response);
      if (!response.ok || !payload.success || !payload.data?.documents) {
        throw new Error(getErrorMessage(payload, "Unable to load documents."));
      }
      set({ documents: payload.data.documents });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to load documents.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDocument: async (documentId) => {
    set({ isLoading: true, error: null, activeDocument: null });
    try {
      const response = await fetch(`/api/v1/documents/${documentId}`, {
        method: "GET",
      });
      const payload = await readResponse(response);
      const document = payload.data?.document;
      if (!response.ok || !payload.success || !document) {
        throw new Error(getErrorMessage(payload, "Unable to load document."));
      }
      set({ activeDocument: document });
      return document;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to load document.",
      });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  createDocument: async (title) => {
    if (get().isCreating) return null;
    set({ isCreating: true, error: null });
    try {
      const response = await fetch("/api/v1/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(title?.trim() ? { title: title.trim() } : {}),
      });
      const payload = await readResponse(response);
      const document = payload.data?.document;
      if (!response.ok || !payload.success || !document) {
        throw new Error(getErrorMessage(payload, "Unable to create document."));
      }
      set((state) => ({ documents: [document, ...state.documents] }));
      return document;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to create document.",
      });
      return null;
    } finally {
      set({ isCreating: false });
    }
  },

  saveDocument: async (documentId, input) => {
    if (get().isSaving) return null;
    set({ isSaving: true, saveError: null });
    try {
      const response = await fetch(`/api/v1/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await readResponse(response);
      const document = payload.data?.document;
      if (!response.ok || !payload.success || !document) {
        throw new Error(getErrorMessage(payload, "Unable to save document."));
      }

      set((state) => ({
        activeDocument: document,
        documents: state.documents.map((item) =>
          item.id === document.id ? document : item,
        ),
      }));
      return document;
    } catch (error) {
      set({
        saveError:
          error instanceof Error ? error.message : "Unable to save document.",
      });
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  fetchDocumentToolHistory: async (documentId) => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/ai-jobs`, {
        method: "GET",
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload.success || !payload.data?.jobs) {
        throw new Error(
          getErrorMessage(payload, "Unable to load tool history."),
        );
      }
      return payload.data.jobs;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to load tool history.",
      });
      return [];
    }
  },

  deleteDocumentToolHistory: async (documentId) => {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/ai-jobs`, {
        method: "DELETE",
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload.success) {
        throw new Error(
          getErrorMessage(payload, "Unable to clear tool history."),
        );
      }
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to clear tool history.",
      });
      return false;
    }
  },

  setFavorite: async (documentId, isFavorite) => {
    if (get().mutatingIds.includes(documentId)) return false;
    set((state) => ({
      mutatingIds: [...state.mutatingIds, documentId],
      error: null,
    }));
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      const payload = await readResponse(response);
      const document = payload.data?.document;
      if (!response.ok || !payload.success || !document) {
        throw new Error(getErrorMessage(payload, "Unable to update favorite."));
      }
      set((state) => ({
        activeDocument:
          state.activeDocument?.id === document.id
            ? document
            : state.activeDocument,
        documents: state.documents.map((item) =>
          item.id === document.id ? document : item,
        ),
      }));
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to update favorite.",
      });
      return false;
    } finally {
      set((state) => ({
        mutatingIds: state.mutatingIds.filter((id) => id !== documentId),
      }));
    }
  },

  setArchived: async (documentId, isArchived) => {
    if (get().mutatingIds.includes(documentId)) return false;
    set((state) => ({
      mutatingIds: [...state.mutatingIds, documentId],
      error: null,
    }));
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });
      const payload = await readResponse(response);
      const document = payload.data?.document;
      if (!response.ok || !payload.success || !document) {
        throw new Error(getErrorMessage(payload, "Unable to update archive."));
      }
      set((state) => ({
        activeDocument:
          state.activeDocument?.id === document.id
            ? document
            : state.activeDocument,
        documents: state.documents.map((item) =>
          item.id === document.id ? document : item,
        ),
      }));
      return true;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to update archive.",
      });
      return false;
    } finally {
      set((state) => ({
        mutatingIds: state.mutatingIds.filter((id) => id !== documentId),
      }));
    }
  },

  clearError: () => set({ error: null, saveError: null }),
}));
