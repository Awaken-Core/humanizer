import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getAiRequestContext, startAiJob, completeAiJob, failAiJob } from "@/lib/ai-request.server";
import { checkRateLimit } from "@/lib/ratelimit";
import { detectAi } from "@/features/ai-detector";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 10;

const ANONYMOUS_MAX_LENGTH = 2000;
const AUTHENTICATED_MAX_LENGTH = 50_000;

const createAiDetectSchema = (maxLength: number) =>
  z.object({
    text: z
      .string({ error: "The 'text' field must be a string." })
      .trim()
      .min(50, "Please provide at least 50 characters for accurate AI detection.")
      .max(maxLength, `Text exceeds the ${maxLength.toLocaleString()}-character limit.`),
  });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // --- 1. Auth context ---
  const context = await getAiRequestContext(req);

  // --- 2. Rate limiting ---
  const rateLimitResult = await checkRateLimit(context.rateLimitIdentifier, context.isAuthenticated);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait before submitting another detection request.",
        retryAfter: rateLimitResult.reset,
      },
      { status: 429 }
    );
  }

  // --- 3. Parse & validate ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const maxLength = context.isAuthenticated ? AUTHENTICATED_MAX_LENGTH : ANONYMOUS_MAX_LENGTH;
  const schema = createAiDetectSchema(maxLength);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // --- 4. Record job ---
  const jobId = await startAiJob({
    context,
    type: "AI_DETECTOR",
    input: { text: parsed.data.text },
  });

  // --- 5. Run detection (synchronous — no LLM) ---
  try {
    const result = detectAi({ text: parsed.data.text });

    await completeAiJob(jobId, result, {
      model: "decision-based",
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    await failAiJob(jobId, error);
    console.error("[/api/v1/ai-detect] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during AI detection." },
      { status: 500 }
    );
  }
}
