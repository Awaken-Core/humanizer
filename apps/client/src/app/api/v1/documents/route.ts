import { withDatabaseScope } from "@/lib/db";
import { NextResponse } from "next/server";
import { Document, DocumentVersion } from "@/modal/document";
import { CreateDocumentDto } from "@/features/documents/document.dto";
import {
  getAuthenticatedDocumentUser,
  serializeDocument,
} from "@/lib/document.server";

async function handleGET() {
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

    const documents = await Document.find({ ownerId: user.id })
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json({
      success: true,
      data: { documents: documents.map(serializeDocument) },
    });
  } catch (error) {
    console.error(
      "Failed to list documents:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to load documents.",
        },
      },
      { status: 500 },
    );
  }
}

async function handlePOST(request: Request) {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = CreateDocumentDto.safeParse(body);
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

    const document = await Document.create({
      title: parsed.data.title || "Untitled document",
      ownerId: user.id,
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    await DocumentVersion.create({
      documentId: document._id,
      version: 1,
      content: document.content,
      plainText: "",
      wordCount: 0,
      characterCount: 0,
      contentSchemaVersion: 1,
      createdBy: user.id,
    });

    return NextResponse.json(
      { success: true, data: { document: serializeDocument(document) } },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Failed to create document:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create document.",
        },
      },
      { status: 500 },
    );
  }
}

export const GET = withDatabaseScope(handleGET);
export const POST = withDatabaseScope(handlePOST);
