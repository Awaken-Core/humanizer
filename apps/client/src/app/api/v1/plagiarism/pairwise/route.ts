import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { comparePairwise } from "@/features/plagiarism/plagiarism.pairwise";

const PairwiseRequestSchema = z.object({
  docA: z
    .string()
    .min(1, "Document A cannot be empty")
    .max(200_000, "Document A exceeds maximum length of 200,000 characters"),
  docB: z
    .string()
    .min(1, "Document B cannot be empty")
    .max(200_000, "Document B exceeds maximum length of 200,000 characters"),
  docAName: z.string().max(100).optional(),
  docBName: z.string().max(100).optional(),
  settings: z
    .object({
      excludeQuotes: z.boolean().optional(),
      excludeBibliography: z.boolean().optional(),
      excludeSmallMatches: z.boolean().optional(),
      minWordsThreshold: z.number().int().min(3).max(30).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
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
        { status: 415 }
      );
    }

    const body = await req.json();
    const parsed = PairwiseRequestSchema.safeParse(body);

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
        { status: 400 }
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
      error instanceof Error ? error.message : "Failed to execute pairwise comparison.";
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message },
      },
      { status: 500 }
    );
  }
}

