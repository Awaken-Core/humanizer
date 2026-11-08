import { withDatabaseScope } from "@/lib/db";
if (typeof window !== "undefined") {
  throw new Error("This module can only be executed on the server.");
}

import { NextRequest, NextResponse } from "next/server";
import {
  getAiRequestContext,
  startAiJob,
  completeAiJob,
  failAiJob,
} from "@/lib/ai-request.server";
import { checkRateLimit } from "@/lib/ratelimit";
import { detectAi } from "@/features/ai-detector";
import { createAiDetectDto } from "@/features/ai-detector/ai-detector.dto";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.dto";
import { createNormalizedErrorResponse } from "@/lib/server-error";

export const runtime = "nodejs";
export const maxDuration = 15;

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let jobId: string | undefined;

  try {
    // --- 1. Auth context ---
    const context = await getAiRequestContext(req);

    // --- 2. Rate limiting ---
    const rateLimitResult = await checkRateLimit(
      context.rateLimitIdentifier,
      context.isAuthenticated,
    );
    if (!rateLimitResult.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
      );
      return createNormalizedErrorResponse(new Error("Rate limit exceeded."), {
        tool: "ai-detector",
        requestId,
        status: 429,
        overrideCode: "APP_RATE_LIMIT_EXCEEDED",
        overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    // --- 3. Parse & validate ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createNormalizedErrorResponse(new Error("Invalid JSON in request body."), {
        tool: "ai-detector",
        requestId,
        status: 400,
        overrideCode: "INVALID_JSON",
      });
    }

    const maxLength = context.isAuthenticated
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;
    const schema = createAiDetectDto(maxLength);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request payload.";
      return createNormalizedErrorResponse(new Error(message), {
        tool: "ai-detector",
        requestId,
        status: 400,
        overrideCode: "VALIDATION_ERROR",
        overrideMessage: message,
      });
    }

    // --- 4. Record job ---
    jobId = await startAiJob({
      context,
      type: "AI_DETECTOR",
      input: { text: parsed.data.text },
    });

    // --- 5. Run detection (synchronous heuristics — no LLM) ---
    const result = detectAi({ text: parsed.data.text });

    await completeAiJob(jobId, result, {
      model: "decision-based",
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: { "X-Request-Id": requestId },
      },
    );
  } catch (error) {
    if (jobId) await failAiJob(jobId, error);
    return createNormalizedErrorResponse(error, {
      tool: "ai-detector",
      requestId,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
