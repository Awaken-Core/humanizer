import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.dto";
import { getAiRequestContext, type AiRequestContext } from "@/lib/ai-request.server";
import { createNormalizedErrorResponse, type StandardApiError } from "@/lib/server-error";
import { z } from "zod";

export interface ParsedApiRequest<T> {
  success: true;
  requestId: string;
  requestContext: AiRequestContext;
  data: T;
  rateLimitHeaders: Record<string, string>;
}

export interface FailedApiRequest {
  success: false;
  response: NextResponse<StandardApiError>;
}

/**
 * Validates Content-Type, parses JSON body, checks session length limits,
 * parses Zod schema, and verifies rate limits with all standard headers.
 * Reduces code duplication across AI tool API routes while maintaining strict security.
 */
export async function parseAndValidateApiRequest<T>(
  req: NextRequest,
  tool: string,
  requestId: string,
  schemaFactory: (maxLength: number) => z.ZodSchema<T>,
): Promise<ParsedApiRequest<T> | FailedApiRequest> {
  // 1. Content-Type Validation (HTTP 415)
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      success: false,
      response: createNormalizedErrorResponse(
        new Error("Content-Type must be application/json."),
        {
          tool,
          requestId,
          status: 415,
          overrideCode: "UNSUPPORTED_MEDIA_TYPE",
        },
      ),
    };
  }

  // 2. Parse JSON Body (HTTP 400)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      success: false,
      response: createNormalizedErrorResponse(
        new Error("Request body contains invalid or malformed JSON."),
        {
          tool,
          requestId,
          status: 400,
          overrideCode: "INVALID_JSON",
        },
      ),
    };
  }

  // 3. User & Session Context
  const requestContext = await getAiRequestContext(req);
  const maxInputLength = requestContext.isAuthenticated
    ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
    : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;

  // 4. Schema Validation (HTTP 413 or 400)
  const parseResult = schemaFactory(maxInputLength).safeParse(body);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const message = issue?.message || "Invalid input parameters.";
    const isLengthError =
      issue?.code === "too_big" ||
      message.includes(maxInputLength.toLocaleString());

    return {
      success: false,
      response: createNormalizedErrorResponse(new Error(message), {
        tool,
        requestId,
        status: isLengthError ? 413 : 400,
        overrideCode: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
        overrideMessage: message,
      }),
    };
  }

  // 5. Rate Limiting (HTTP 503 or 429)
  const rateLimit = await checkRateLimit(
    requestContext.rateLimitIdentifier,
    requestContext.isAuthenticated,
  );

  if (rateLimit.serviceUnavailable) {
    return {
      success: false,
      response: createNormalizedErrorResponse(
        new Error("Rate limiting service unavailable."),
        {
          tool,
          requestId,
          status: 503,
          overrideCode: "SERVICE_UNAVAILABLE",
          overrideMessage:
            "Rate limiting service is temporarily unavailable. Please try again shortly.",
        },
      ),
    };
  }

  if (!rateLimit.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((rateLimit.reset - Date.now()) / 1000),
    );

    return {
      success: false,
      response: createNormalizedErrorResponse(
        new Error("Rate limit exceeded."),
        {
          tool,
          requestId,
          status: 429,
          overrideCode: "APP_RATE_LIMIT_EXCEEDED",
          overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
          retryAfter: retryAfterSec,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.reset),
          },
        },
      ),
    };
  }

  // Success headers preserved for client transparency
  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };

  return {
    success: true,
    requestId,
    requestContext,
    data: parseResult.data,
    rateLimitHeaders,
  };
}

