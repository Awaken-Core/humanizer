import { create } from "zustand";

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
  data?: { document?: BoardDocument; documents?: BoardDocument[] };
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
  setFavorite: (documentId: string, isFavorite: boolean) => Promise<void>;
  setArchived: (documentId: string, isArchived: boolean) => Promise<void>;
  clearError: () => void;
}

function getErrorMessage(payload: DocumentApiResponse, fallback: string) {
  return typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || fallback;
}

async function readResponse(response: Response): Promise<DocumentApiResponse> {
  try {
    return (await response.json()) as DocumentApiResponse;
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

  setFavorite: async (documentId, isFavorite) => {
    if (get().mutatingIds.includes(documentId)) return;
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
        documents: state.documents.map((item) =>
          item.id === document.id ? document : item,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to update favorite.",
      });
    } finally {
      set((state) => ({
        mutatingIds: state.mutatingIds.filter((id) => id !== documentId),
      }));
    }
  },

  setArchived: async (documentId, isArchived) => {
    if (get().mutatingIds.includes(documentId)) return;
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
        documents: state.documents.map((item) =>
          item.id === document.id ? document : item,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Unable to update archive.",
      });
    } finally {
      set((state) => ({
        mutatingIds: state.mutatingIds.filter((id) => id !== documentId),
      }));
    }
  },

  clearError: () => set({ error: null, saveError: null }),
}));
