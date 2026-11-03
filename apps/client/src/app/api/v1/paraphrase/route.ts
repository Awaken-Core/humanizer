import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { HumanizerError } from "@/features/humanizer";
import {
  MAX_PARAPHRASE_TEXT_LENGTH,
  ParaphraseTextInputSchema,
  paraphraseText,
} from "@/features/paraphraser";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip && ip !== "::1" && ip !== "127.0.0.1") return ip;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();

  return "anonymous-unknown-ip";
}

async function getAuthenticatedUser(
  req: NextRequest
): Promise<{ id: string; email?: string } | null> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user) {
      return { id: session.user.id, email: session.user.email };
    }
  } catch {
    // Continue as an anonymous user when authentication is unavailable.
  }

  return null;
}

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

    const parseResult = ParaphraseTextInputSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue?.message || "Invalid input parameters.";
      const isLengthError =
        issue?.code === "too_big" ||
        message.includes(MAX_PARAPHRASE_TEXT_LENGTH.toLocaleString());

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

    const sessionUser = await getAuthenticatedUser(req);
    const isAuthenticated = !!sessionUser;
    const rateLimitIdentifier = isAuthenticated
      ? `paraphrase:user:${sessionUser!.id}`
      : `paraphrase:ip:${getClientIp(req)}`;

    const rateLimit = await checkRateLimit(
      rateLimitIdentifier,
      isAuthenticated
    );

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
        Math.ceil((rateLimit.reset - Date.now()) / 1_000)
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

    const result = await paraphraseText(parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: {
          originalText: result.originalText,
          paraphrasedText: result.paraphrasedText,
          selectedTone: result.selectedTone.toLowerCase(),
          selectedFocus: result.selectedFocus.toLowerCase(),
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
    if (error instanceof HumanizerError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("timeout")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_TIMEOUT",
            message:
              "The AI request timed out. Please try again with shorter text.",
          },
        },
        { status: 504 }
      );
    }

    console.error("Unhandled error in /api/v1/paraphrase:", message);
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
