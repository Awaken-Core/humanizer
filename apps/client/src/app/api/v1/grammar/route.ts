import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  getAiRequestContext,
  startAiJob,
  completeAiJob,
  failAiJob,
} from "@/lib/ai-request.server";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  checkGrammar,
  ANONYMOUS_MAX_GRAMMAR_LENGTH,
  AUTHENTICATED_MAX_GRAMMAR_LENGTH,
} from "@/features/grammar";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 45;

const createGrammarInputSchema = (maxLength: number) =>
  z.object({
    text: z
      .string({ error: "The 'text' field must be a string." })
      .trim()
      .min(1, "Input text cannot be empty or contain only whitespace.")
      .max(maxLength, `Text exceeds the ${maxLength.toLocaleString()}-character limit.`),
  });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // 1. Auth context
  const context = await getAiRequestContext(req);

  // 2. Rate limiting
  const rateLimitResult = await checkRateLimit(
    context.rateLimitIdentifier,
    context.isAuthenticated
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait before submitting another grammar check.",
        retryAfter: rateLimitResult.reset,
      },
      { status: 429 }
    );
  }

  // 3. Parse & validate JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
  }

  const maxLength = context.isAuthenticated
    ? AUTHENTICATED_MAX_GRAMMAR_LENGTH
    : ANONYMOUS_MAX_GRAMMAR_LENGTH;

  const schema = createGrammarInputSchema(maxLength);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 4. Record job
  const jobId = await startAiJob({
    context,
    type: "GRAMMAR_CHECKER",
    input: { text: parsed.data.text },
  });

  // 5. Execute grammar check
  try {
    const result = await checkGrammar({ text: parsed.data.text });

    await completeAiJob(jobId, result, {
      model: "deterministic+deepseek",
      durationMs: Date.now() - start,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    await failAiJob(jobId, error);
    console.error("[/api/v1/grammar] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during grammar checking." },
      { status: 500 }
    );
  }
}

