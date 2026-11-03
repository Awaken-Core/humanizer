import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import {
  humanizeText,
  HumanizeTextInputSchema,
  HumanizerError,
  MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer";

/**
 * Extracts client IP address safely from standard headers
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && ip !== "::1" && ip !== "127.0.0.1") return ip;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  return "anonymous-unknown-ip";
}

/**
 * Lazily retrieves session without top-level module blocking if database isn't initialized
 */
async function getAuthenticatedUser(
  req: NextRequest
): Promise<{ id: string; email?: string } | null> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
      };
    }
  } catch {
    // Non-blocking: Treat as anonymous user if auth service cannot be reached
  }
  return null;
}

/**
 * POST /api/humanize
 * Thin endpoint orchestrating validation, rate-limiting, authentication, and execution.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Content-Type Validation
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

    // 2. Parse JSON Body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body contains invalid or malformed JSON.",
          },
        },
        { status: 400 }
      );
    }

    // 3. Request Validation with Zod Schema
    const parseResult = HumanizeTextInputSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue?.message || "Invalid input parameters.";

      // Check if this was a payload size violation
      const isLengthError =
        issue?.code === "too_big" ||
        message.includes(MAX_INPUT_TEXT_LENGTH.toLocaleString());

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
            message,
          },
        },
        { status: isLengthError ? 413 : 400 }
      );
    }

    // 4. Session & Authentication Check (Better Auth)
    const sessionUser = await getAuthenticatedUser(req);

    // 5. Rate Limiting (User ID or IP Address)
    const isAuthenticated = !!sessionUser;
    const rateLimitIdentifier = isAuthenticated
      ? `user:${sessionUser!.id}`
      : `ip:${getClientIp(req)}`;

    const rateLimit = await checkRateLimit(rateLimitIdentifier, isAuthenticated);

    // In production, fail closed with 503 if strict rate limiting cannot be enforced
    if (rateLimit.serviceUnavailable) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message:
              "Rate limiting service is temporarily unavailable. Request blocked for system protection.",
          },
        },
        { status: 503 }
      );
    }

    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000)
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.reset),
          },
        }
      );
    }

    // 6. Execute Humanization Service
    const result = await humanizeText(parseResult.data);

    // 7. Success Response
    return NextResponse.json(
      {
        success: true,
        data: {
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
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error: unknown) {
    // 8. Error Mapping
    if (error instanceof HumanizerError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    // Check for DeepSeek / network timeout error
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.toLowerCase().includes("timeout")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_TIMEOUT",
            message: "The AI request timed out. Please try again with shorter text.",
          },
        },
        { status: 504 }
      );
    }

    // Log unexpected errors safely on the server without leaking sensitive text
    console.error("Unhandled error in /api/humanize:", errMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred while processing your request.",
        },
      },
      { status: 500 }
    );
  }
}
