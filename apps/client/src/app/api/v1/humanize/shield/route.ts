import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { shieldCitations } from "@/features/humanizer/citation-shield";

const ShieldRequestSchema = z.object({
  text: z.string().min(1, "Text cannot be empty").max(100_000, "Text exceeds maximum limit"),
  style: z.enum(["latex", "ieee", "apa"]).default("latex"),
  discipline: z
    .enum(["computer-science", "engineering", "mathematics", "finance", "medicine", "general"])
    .default("computer-science"),
  maxCitations: z.number().int().positive().optional(),
  densityThreshold: z.number().int().min(3).max(15).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." },
        },
        { status: 415 }
      );
    }

    const body = await req.json();
    const parsed = ShieldRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const result = shieldCitations(parsed.data.text, {
      style: parsed.data.style,
      discipline: parsed.data.discipline,
      maxCitations: parsed.data.maxCitations,
      densityThreshold: parsed.data.densityThreshold,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute citation shielding.";
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message },
      },
      { status: 500 }
    );
  }
}

