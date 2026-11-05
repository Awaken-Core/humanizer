import { withDatabaseScope } from "@/lib/db";
import { NextResponse } from "next/server";
import { Document } from "@/modal/document";
import {
  DocumentIdParamsDto,
  FavoriteDocumentDto,
} from "@/features/documents/document.dto";
import {
  getAuthenticatedDocumentUser,
  serializeDocument,
} from "@/lib/document.server";

async function handlePATCH(
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

  const params = DocumentIdParamsDto.safeParse(await context.params);
  if (!params.success)
    return NextResponse.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Document not found." },
      },
      { status: 404 },
    );
  const { documentId } = params.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = FavoriteDocumentDto.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "isFavorite must be a boolean.",
        },
      },
      { status: 400 },
    );

  const document = await Document.findOneAndUpdate(
    { _id: documentId, ownerId: user.id },
    { $set: { isFavorite: parsed.data.isFavorite } },
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

export const PATCH = withDatabaseScope(handlePATCH);
