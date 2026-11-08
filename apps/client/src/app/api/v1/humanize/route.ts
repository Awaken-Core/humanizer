import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { humanizeText, HumanizerError } from "@/features/humanizer";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
  createHumanizeTextInputSchema,
} from "@/features/humanizer/humanizer.dto";
import {
  completeAiJob,
  failAiJob,
  getAiRequestContext,
  startAiJob,
} from "@/lib/ai-request.server";
import { createNormalizedErrorResponse } from "@/lib/server-error";

export const maxDuration = 60;

/**
 * POST /api/humanize
 * Thin endpoint orchestrating validation, rate-limiting, authentication, and execution.
 */
async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;
  try {
    // 1. Content-Type Validation
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return createNormalizedErrorResponse(new Error("Content-Type must be application/json."), {
        tool: "humanizer",
        requestId,
        status: 415,
        overrideCode: "UNSUPPORTED_MEDIA_TYPE",
      });
    }

    // 2. Parse JSON Body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createNormalizedErrorResponse(new Error("Request body contains invalid or malformed JSON."), {
        tool: "humanizer",
        requestId,
        status: 400,
        overrideCode: "INVALID_JSON",
      });
    }

    // The verified server session controls the input limit.
    const requestContext = await getAiRequestContext(req);
    const maxInputLength = requestContext.isAuthenticated
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;
    const parseResult =
      createHumanizeTextInputSchema(maxInputLength).safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue?.message || "Invalid input parameters.";

      // Check if this was a payload size violation
      const isLengthError =
        issue?.code === "too_big" ||
        message.includes(maxInputLength.toLocaleString());

      return createNormalizedErrorResponse(new Error(message), {
        tool: "humanizer",
        requestId,
        status: isLengthError ? 413 : 400,
        overrideCode: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
        overrideMessage: message,
      });
    }

    const rateLimit = await checkRateLimit(
      requestContext.rateLimitIdentifier,
      requestContext.isAuthenticated,
    );

    // In production, fail closed with 503 if strict rate limiting cannot be enforced
    if (rateLimit.serviceUnavailable) {
      return createNormalizedErrorResponse(new Error("Rate limiting service unavailable."), {
        tool: "humanizer",
        requestId,
        status: 503,
        overrideCode: "SERVICE_UNAVAILABLE",
        overrideMessage: "Rate limiting service is temporarily unavailable. Please try again shortly.",
      });
    }

    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000),
      );

      return createNormalizedErrorResponse(new Error("Rate limit exceeded."), {
        tool: "humanizer",
        requestId,
        status: 429,
        overrideCode: "APP_RATE_LIMIT_EXCEEDED",
        overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    jobId = await startAiJob({
      context: requestContext,
      type: "AI_HUMANIZER",
      input: {
        text: parseResult.data.text,
        mode: parseResult.data.mode,
        intensity: parseResult.data.intensity,
      },
    });

    const result = await humanizeText(parseResult.data);
    await completeAiJob(
      jobId,
      {
        content: result.humanizedText,
        detectedLanguage: result.detectedLanguage,
      },
      {
        model: result.processingMetadata.model,
        durationMs: result.processingMetadata.durationMs,
        promptTokens: result.processingMetadata.tokens?.promptTokens,
        completionTokens: result.processingMetadata.tokens?.completionTokens,
      },
    );

    // 7. Success Response
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          originalText: result.originalText,
          humanizedText: result.humanizedText,
          detectedLanguage: result.detectedLanguage,
          selectedMode: result.selectedMode.toLowerCase(),
          selectedIntensity: result.selectedIntensity.toLowerCase(),
          processingMetadata: {
            model: result.processingMetadata.model,
            duration: result.processingMetadata.durationMs,
            tokenUsage: result.processingMetadata.tokens
              ? {
                  promptTokens:
                    result.processingMetadata.tokens.promptTokens ?? 0,
                  completionTokens:
                    result.processingMetadata.tokens.completionTokens ?? 0,
                  totalTokens:
                    result.processingMetadata.tokens.totalTokens ?? 0,
                }
              : undefined,
          },
        },
      },
      {
        status: 200,
        headers: {
          "X-Request-Id": requestId,
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  } catch (error: unknown) {
    if (jobId) await failAiJob(jobId, error);
    return createNormalizedErrorResponse(error, {
      tool: "humanizer",
      requestId,
      status: error instanceof HumanizerError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
