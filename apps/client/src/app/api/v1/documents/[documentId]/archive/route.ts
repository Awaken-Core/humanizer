import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Document } from "@/modal/document";
import {
  getAuthenticatedDocumentUser,
  serializeDocument,
} from "@/lib/document.server";

const archiveSchema = z.object({ isArchived: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const user = await getAuthenticatedDocumentUser();
  if (!user)
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      },
      { status: 401 },
    );

  const { documentId } = await context.params;
  if (!mongoose.isValidObjectId(documentId))
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Document not found." },
      },
      { status: 404 },
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "isArchived must be a boolean.",
        },
      },
      { status: 400 },
    );

  const document = await Document.findOneAndUpdate(
    { _id: documentId, ownerId: user.id },
    { $set: { isArchived: parsed.data.isArchived } },
    { returnDocument: "after" },
  );
  if (!document)
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Document not found." },
      },
      { status: 404 },
    );

  return NextResponse.json({
    success: true,
    data: { document: serializeDocument(document) },
  });
}
