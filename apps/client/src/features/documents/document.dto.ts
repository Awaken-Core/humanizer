import { z } from "zod";

export const DocumentIdParamsDto = z
  .object({
    documentId: z.string().regex(/^[a-f\d]{24}$/i, "Document not found."),
  })
  .strict();

export const CreateDocumentDto = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const UpdateDocumentDto = z
  .object({
    title: z.string().trim().min(1).max(120),
    content: z
      .object({
        type: z.literal("doc"),
        content: z.array(z.unknown()).optional(),
      })
      .passthrough(),
    plainText: z.string().max(1_000_000),
    wordCount: z.number().int().nonnegative(),
    characterCount: z.number().int().nonnegative(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const FavoriteDocumentDto = z
  .object({ isFavorite: z.boolean() })
  .strict();

export const ArchiveDocumentDto = z
  .object({ isArchived: z.boolean() })
  .strict();

export const BoardDocumentDto = z
  .object({
    id: z.string(),
    title: z.string(),
    latestVersion: z.number().int().positive(),
    wordCount: z.number().int().nonnegative(),
    characterCount: z.number().int().nonnegative(),
    content: z.record(z.string(), z.unknown()),
    plainText: z.string(),
    contentSchemaVersion: z.number().int().positive(),
    isFavorite: z.boolean(),
    isArchived: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const DocumentToolHistoryRecordDto = z
  .object({
    id: z.string(),
    service: z.enum([
      "humanizer",
      "plagiarism-checker",
      "ai-detector",
      "paraphraser",
      "summarizer",
      "grammar-checker",
    ]),
    input: z.string(),
    output: z.string(),
    source: z.enum(["document", "selection"]),
    createdAt: z.string(),
    failed: z.boolean().optional(),
  })
  .strict();

export const DocumentApiResponseDto = z
  .object({
    success: z.boolean().optional(),
    data: z
      .object({
        document: BoardDocumentDto.optional(),
        documents: z.array(BoardDocumentDto).optional(),
        jobs: z.array(DocumentToolHistoryRecordDto).optional(),
      })
      .passthrough()
      .optional(),
    error: z
      .union([
        z.string(),
        z.object({ message: z.string().optional() }).passthrough(),
      ])
      .optional(),
  })
  .passthrough();
