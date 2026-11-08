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
import { checkGrammar } from "@/features/grammar";
import { createGrammarInputDto } from "@/features/grammar/grammar.dto";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.dto";
import { createNormalizedErrorResponse } from "@/lib/server-error";

export const runtime = "nodejs";
export const maxDuration = 45;

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let jobId: string | undefined;

  try {
    // 1. Auth context
    const context = await getAiRequestContext(req);

    // 2. Rate limiting
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
        tool: "grammar-checker",
        requestId,
        status: 429,
        overrideCode: "APP_RATE_LIMIT_EXCEEDED",
        overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    // 3. Parse & validate JSON body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createNormalizedErrorResponse(new Error("Invalid JSON in request body."), {
        tool: "grammar-checker",
        requestId,
        status: 400,
        overrideCode: "INVALID_JSON",
      });
    }

    const maxLength = context.isAuthenticated
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;

    const schema = createGrammarInputDto(maxLength);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid request payload.";
      return createNormalizedErrorResponse(new Error(message), {
        tool: "grammar-checker",
        requestId,
        status: 400,
        overrideCode: "VALIDATION_ERROR",
        overrideMessage: message,
      });
    }

    // 4. Record job
    jobId = await startAiJob({
      context,
      type: "GRAMMAR_CHECKER",
      input: { text: parsed.data.text },
    });

    // 5. Execute grammar check (has internal deterministic fallback if LLM times out)
    const result = await checkGrammar({ text: parsed.data.text });

    await completeAiJob(jobId, result, {
      model: "deterministic+deepseek",
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
      tool: "grammar-checker",
      requestId,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
