import { withDatabaseScope } from "@/lib/db";
import { NextResponse } from "next/server";
import { Document, DocumentVersion } from "@/modal/document";
import {
  DocumentIdParamsDto,
  UpdateDocumentDto,
} from "@/features/documents/document.dto";
import {
  getAuthenticatedDocumentUser,
  serializeDocument,
} from "@/lib/document.server";

async function handleGET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
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

    const document = await Document.findOne({
      _id: documentId,
      ownerId: user.id,
    });
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
  } catch (error) {
    console.error(
      "Failed to load document:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to load document.",
        },
      },
      { status: 500 },
    );
  }
}

async function handlePATCH(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await getAuthenticatedDocumentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required." },
        },
        { status: 401 },
      );
    }

    const params = DocumentIdParamsDto.safeParse(await context.params);
    if (!params.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Document not found." },
        },
        { status: 404 },
      );
    }
    const { documentId } = params.data;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "Invalid request body." },
        },
        { status: 400 },
      );
    }

    const parsed = UpdateDocumentDto.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid document.",
          },
        },
        { status: 400 },
      );
    }

    const contentSize = JSON.stringify(parsed.data.content).length;
    if (contentSize > 2_000_000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Document content exceeds the 2 MB limit.",
          },
        },
        { status: 413 },
      );
    }

    const document = await Document.findOneAndUpdate(
      {
        _id: documentId,
        ownerId: user.id,
      },
      {
        $set: {
          title: parsed.data.title,
          content: parsed.data.content,
          plainText: parsed.data.plainText,
          wordCount: parsed.data.wordCount,
          characterCount: parsed.data.characterCount,
          contentSchemaVersion: 1,
        },
        $inc: { latestVersion: 1 },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!document) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Document not found.",
          },
        },
        { status: 404 },
      );
    }

    await DocumentVersion.create({
      documentId: document._id,
      version: document.latestVersion,
      parentVersion: Math.max(1, document.latestVersion - 1),
      content: parsed.data.content,
      plainText: parsed.data.plainText,
      wordCount: parsed.data.wordCount,
      characterCount: parsed.data.characterCount,
      contentSchemaVersion: 1,
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      data: { document: serializeDocument(document) },
    });
  } catch (error) {
    console.error(
      "Failed to save document:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to save document.",
        },
      },
      { status: 500 },
    );
  }
}

export const GET = withDatabaseScope(handleGET);
export const PATCH = withDatabaseScope(handlePATCH);
