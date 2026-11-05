import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { comparePairwise } from "@/features/plagiarism/plagiarism.pairwise";
import { PairwiseRequestDto } from "@/features/plagiarism/plagiarism-pairwise.dto";

async function handlePOST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Content-Type must be application/json.",
          },
        },
        { status: 415 },
      );
    }

    const body = await req.json();
    const parsed = PairwiseRequestDto.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed for pairwise comparison request.",
            details: parsed.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { docA, docB, docAName, docBName, settings } = parsed.data;

    const result = await comparePairwise(docA, docB, {
      docAName,
      docBName,
      settings,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to execute pairwise comparison.";
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message },
      },
      { status: 500 },
    );
  }
}

export const POST = withDatabaseScope(handlePOST);
