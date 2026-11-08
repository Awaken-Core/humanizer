import { NextResponse } from "next/server";

export interface StandardApiError {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    retryAfter?: number;
  };
}

export interface ErrorClassification {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  retryAfter?: number;
}

/**
 * Sanitizes any data or object before logging to console/telemetry.
 * Strips API keys, Bearer tokens, passwords, MongoDB URLs, and full user text.
 */
export function sanitizeLogData(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    return input
      .replace(/sk-[a-zA-Z0-9_-]{15,}/g, "[REDACTED_API_KEY]")
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED_TOKEN]")
      .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[REDACTED_DB_URL]")
      .replace(/[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  }
  if (input instanceof Error) {
    return {
      name: input.name,
      message: sanitizeLogData(input.message),
      // Clean stack to prevent local machine path disclosure in logs
      stack: input.stack
        ? input.stack
            .split("\n")
            .slice(0, 5)
            .map((line) => line.replace(/C:\\Users\\[^\\]+\\/gi, "C:\\Users\\...\\"))
            .join("\n")
        : undefined,
    };
  }
  if (typeof input === "object") {
    if (Array.isArray(input)) {
      return input.map(sanitizeLogData);
    }
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("password") ||
        lowerKey.includes("auth")
      ) {
        sanitizedObj[key] = "[REDACTED]";
      } else if (lowerKey === "text" || lowerKey === "prompt" || lowerKey === "content") {
        if (typeof value === "string") {
          sanitizedObj[key] = `[TEXT_OMITTED: length=${value.length}]`;
        } else {
          sanitizedObj[key] = "[CONTENT_OMITTED]";
        }
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }
  return input;
}

/**
 * Classifies an unknown error into a secure, user-friendly public error response.
 * Never exposes upstream vendor names (DeepSeek), stack traces, or internal paths.
 * Accurately aligns status codes with retryable classification.
 */
export function classifyError(error: unknown, statusHint?: number): ErrorClassification {
  const errString = error instanceof Error ? error.message : String(error);
  const lower = errString.toLowerCase();
  const rawStatus = (error as { status?: number })?.status ?? statusHint;

  // 1. Content-Type / Unsupported Media Type (HTTP 415) - Non-retryable
  if (
    rawStatus === 415 ||
    lower.includes("unsupported_media_type") ||
    lower.includes("content-type must be") ||
    lower.includes("unsupported media")
  ) {
    return {
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Content-Type must be application/json.",
      status: 415,
      retryable: false,
    };
  }

  // 2. Upstream Provider Authentication / Key / Billing failure (HTTP 401 / 403 / 503) - Non-retryable from client
  if (
    rawStatus === 401 ||
    rawStatus === 403 ||
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication")
  ) {
    return {
      code: "AI_SERVICE_UNAVAILABLE",
      message: "Our AI writing service is temporarily unavailable. Please try again shortly.",
      status: rawStatus === 401 || rawStatus === 403 ? rawStatus : 503,
      retryable: false,
    };
  }

  // 3. User/Client App Rate Limit (HTTP 429) - Retryable
  if (rawStatus === 429 || lower.includes("rate limit exceeded") || lower.includes("too many requests")) {
    return {
      code: "APP_RATE_LIMIT_EXCEEDED",
      message: "You have submitted too many requests. Please wait a moment before trying again.",
      status: 429,
      retryable: true,
    };
  }

  // 4. Upstream AI Provider Rate Limit / Capacity Busy (HTTP 503) - Retryable
  if (rawStatus === 503 || lower.includes("quota") || lower.includes("rate_limit")) {
    return {
      code: "AI_UPSTREAM_BUSY",
      message: "Our AI engine is currently experiencing high demand. Please try again shortly.",
      status: 503,
      retryable: true,
      retryAfter: 6,
    };
  }

  // 5. Execution Timeouts (HTTP 408 / 504 / Abort / Fetch Timeout) - Retryable
  if (
    rawStatus === 408 ||
    rawStatus === 504 ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborterror") ||
    lower.includes("aborted")
  ) {
    const status = rawStatus === 408 ? 408 : 504;
    return {
      code: "REQUEST_TIMEOUT",
      message: "Processing took longer than expected. Please try again with shorter text.",
      status,
      retryable: true,
    };
  }

  // 6. Payload Too Large (Character limits - HTTP 413) - Non-retryable
  if (
    rawStatus === 413 ||
    lower.includes("payload_too_large") ||
    lower.includes("too_big") ||
    lower.includes("maximum allowed limit")
  ) {
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: "The submitted text exceeds the maximum character limit.",
      status: 413,
      retryable: false,
    };
  }

  // 7. Validation Errors (HTTP 400) - Non-retryable
  if (
    rawStatus === 400 ||
    lower.includes("validation") ||
    lower.includes("invalid input") ||
    lower.includes("at least 50 characters") ||
    lower.includes("whitespace")
  ) {
    return {
      code: "VALIDATION_ERROR",
      message:
        error instanceof Error && !lower.includes("deepseek") && !lower.includes("server")
          ? error.message
          : "Please verify your input text and settings before retrying.",
      status: 400,
      retryable: false,
    };
  }

  // 8. Upstream Provider 5xx / Bad Gateway (HTTP 502) - Retryable
  if (rawStatus === 502 || lower.includes("bad gateway") || lower.includes("upstream")) {
    return {
      code: "AI_SERVICE_DEGRADED",
      message: "The AI service encountered a temporary hiccup. Please click Try Again.",
      status: 502,
      retryable: true,
    };
  }

  // 9. General Internal Server Error (HTTP 500) - Retryable
  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred while processing your request. Please try again.",
    status: 500,
    retryable: true,
  };
}

/**
 * Creates a normalized, privacy-hardened JSON error response with full UUID requestId.
 * Preserves rate-limit headers (X-RateLimit-*, Retry-After) when provided.
 */
export function createNormalizedErrorResponse(
  error: unknown,
  options: {
    tool: string;
    requestId?: string;
    status?: number;
    overrideCode?: string;
    overrideMessage?: string;
    retryAfter?: number;
    headers?: Record<string, string>;
    extraLogInfo?: Record<string, unknown>;
  }
): NextResponse<StandardApiError> {
  const requestId = options.requestId || crypto.randomUUID();
  const classification = classifyError(error, options.status);

  const code = options.overrideCode || classification.code;
  const message = options.overrideMessage || classification.message;
  const status = options.status || classification.status;
  const retryable = classification.retryable;
  const retryAfter = options.retryAfter ?? classification.retryAfter;

  // Safe internal server logging (scrubbed of user prose, keys, tokens)
  console.error(
    `[TOOL_ERROR:${options.tool}] requestId=${requestId} status=${status} code=${code}`,
    sanitizeLogData({
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      context: options.extraLogInfo,
    })
  );

  const responseHeaders: Record<string, string> = {
    "X-Request-Id": requestId,
    ...(options.headers || {}),
  };

  if (retryAfter) {
    responseHeaders["Retry-After"] = String(retryAfter);
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        requestId,
        retryable,
        ...(retryAfter ? { retryAfter } : {}),
      },
    },
    {
      status,
      headers: responseHeaders,
    }
  );
}
