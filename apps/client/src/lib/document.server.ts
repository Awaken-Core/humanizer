if (typeof window !== "undefined") {
  throw new Error("This module can only be executed on the server.");
}

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { client } from "@/lib/db";

export async function getAuthenticatedDocumentUser() {
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  await client();
  return session.user;
}

export function serializeDocument(document: {
  _id: { toString(): string };
  title: string;
  latestVersion: number;
  wordCount: number;
  characterCount: number;
  content: Record<string, unknown>;
  plainText: string;
  contentSchemaVersion: number;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: document._id.toString(),
    title: document.title,
    latestVersion: document.latestVersion,
    wordCount: document.wordCount,
    characterCount: document.characterCount,
    content: document.content,
    plainText: document.plainText,
    contentSchemaVersion: document.contentSchemaVersion,
    isFavorite: document.isFavorite,
    isArchived: document.isArchived,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
