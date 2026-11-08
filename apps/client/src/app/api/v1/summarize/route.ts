import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { HumanizerError } from "@/features/humanizer";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
  createHumanizeTextInputSchema,
} from "@/features/humanizer/humanizer.dto";
import { summarizeText } from "@/features/summarizer";
import {
  completeAiJob,
  failAiJob,
  getAiRequestContext,
  startAiJob,
} from "@/lib/ai-request.server";
import { createNormalizedErrorResponse } from "@/lib/server-error";

export const maxDuration = 45;

async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return createNormalizedErrorResponse(new Error("Content-Type must be application/json."), {
        tool: "summarizer",
        requestId,
        status: 415,
        overrideCode: "UNSUPPORTED_MEDIA_TYPE",
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createNormalizedErrorResponse(new Error("Request body contains invalid or malformed JSON."), {
        tool: "summarizer",
        requestId,
        status: 400,
        overrideCode: "INVALID_JSON",
      });
    }

    const requestContext = await getAiRequestContext(req);
    const maxInputLength = requestContext.isAuthenticated
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;
    const parseResult =
      createHumanizeTextInputSchema(maxInputLength).safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue?.message || "Invalid input parameters.";
      const isLengthError =
        issue?.code === "too_big" ||
        message.includes(maxInputLength.toLocaleString());

      return createNormalizedErrorResponse(new Error(message), {
        tool: "summarizer",
        requestId,
        status: isLengthError ? 413 : 400,
        overrideCode: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
        overrideMessage: message,
      });
    }

    const rateLimit = await checkRateLimit(
      `summarize:${requestContext.rateLimitIdentifier}`,
      requestContext.isAuthenticated,
    );

    if (rateLimit.serviceUnavailable) {
      return createNormalizedErrorResponse(new Error("Rate limiting service unavailable."), {
        tool: "summarizer",
        requestId,
        status: 503,
        overrideCode: "SERVICE_UNAVAILABLE",
        overrideMessage: "Rate limiting service is temporarily unavailable. Please try again shortly.",
      });
    }

    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1_000),
      );

      return createNormalizedErrorResponse(new Error("Rate limit exceeded."), {
        tool: "summarizer",
        requestId,
        status: 429,
        overrideCode: "APP_RATE_LIMIT_EXCEEDED",
        overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    jobId = await startAiJob({
      context: requestContext,
      type: "AI_SUMMARIZER",
      input: {
        text: parseResult.data.text,
        mode: parseResult.data.mode,
        intensity: parseResult.data.intensity,
      },
    });

    const result = await summarizeText(parseResult.data);
    await completeAiJob(
      jobId,
      { content: result.summaryText },
      {
        model: result.processingMetadata.model,
        durationMs: result.processingMetadata.durationMs,
        promptTokens: result.processingMetadata.tokens?.promptTokens,
        completionTokens: result.processingMetadata.tokens?.completionTokens,
      },
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          originalText: result.originalText,
          summaryText: result.summaryText,
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
      tool: "summarizer",
      requestId,
      status: error instanceof HumanizerError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
