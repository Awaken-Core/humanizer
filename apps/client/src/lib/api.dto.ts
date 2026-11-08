import { z } from "zod";

export const StandardApiErrorDetailDto = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  retryable: z.boolean().default(true),
  retryAfter: z.number().optional(),
});

export type StandardApiErrorDetail = z.infer<typeof StandardApiErrorDetailDto>;

export const ToolApiResponseDto = z.object({
  success: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
  error: StandardApiErrorDetailDto.optional(),
});

export type ToolApiResponse = z.infer<typeof ToolApiResponseDto>;

export interface NormalizedClientError {
  code: string;
  message: string;
  requestId?: string;
  retryable: boolean;
  retryAfter?: number;
}

function detectErrorCodeAndRetryable(message: string, explicitCode?: string, explicitRetryable?: boolean): {
  code: string;
  retryable: boolean;
} {
  const lowerMsg = message.toLowerCase();
  let code = explicitCode || "";

  if (!code) {
    if (lowerMsg.includes("not found")) {
      code = "DOCUMENT_NOT_FOUND";
    } else if (
      lowerMsg.includes("authentication required") ||
      lowerMsg.includes("session expired") ||
      lowerMsg.includes("unauthorized") ||
      lowerMsg.includes("sign in")
    ) {
      code = "UNAUTHORIZED";
    } else if (
      lowerMsg.includes("unable to access") ||
      lowerMsg.includes("access denied") ||
      lowerMsg.includes("forbidden") ||
      lowerMsg.includes("permission denied")
    ) {
      code = "ACCESS_DENIED";
    } else if (lowerMsg.includes("content-type") || lowerMsg.includes("media type")) {
      code = "UNSUPPORTED_MEDIA_TYPE";
    } else if (lowerMsg.includes("validation") || lowerMsg.includes("invalid input") || lowerMsg.includes("whitespace")) {
      code = "VALIDATION_ERROR";
    } else {
      code = "API_ERROR";
    }
  }

  if (typeof explicitRetryable === "boolean") {
    return { code, retryable: explicitRetryable };
  }

  const isNonRetryable =
    code === "DOCUMENT_NOT_FOUND" ||
    code === "UNAUTHORIZED" ||
    code === "ACCESS_DENIED" ||
    code === "VALIDATION_ERROR" ||
    code === "UNSUPPORTED_MEDIA_TYPE" ||
    code === "PAYLOAD_TOO_LARGE";

  return { code, retryable: !isNonRetryable };
}

/**
 * Sanitizes and normalizes any client-side error (fetch error, HTTP 4xx/5xx, AbortError, JSON parse error).
 * Preserves legacy message-only errors ({ message: string }) while guaranteeing zero leakage of internal provider names.
 */
export function normalizeClientError(
  rawError: unknown,
  fallbackMessage = "Unable to complete request. Please try again."
): NormalizedClientError {
  if (rawError instanceof DOMException && rawError.name === "AbortError") {
    return {
      code: "REQUEST_ABORTED",
      message: "The request took too long or was cancelled. Please try again.",
      retryable: true,
    };
  }

  if (rawError instanceof TypeError && rawError.message.toLowerCase().includes("fetch")) {
    return {
      code: "NETWORK_ERROR",
      message: "Unable to connect to the server. Please check your internet connection and try again.",
      retryable: true,
    };
  }

  if (typeof rawError === "object" && rawError !== null) {
    const errorObj = rawError as Record<string, unknown>;

    // Unpack nested { error: ... } envelopes
    if (errorObj.error && typeof errorObj.error === "object") {
      return normalizeClientError(errorObj.error, fallbackMessage);
    }
    if (typeof errorObj.error === "string") {
      return normalizeClientError(errorObj.error, fallbackMessage);
    }

    // Handles both structured StandardApiErrorDetail and message-only { message: string } error objects
    if (typeof errorObj.message === "string" && errorObj.message.trim().length > 0) {
      let cleanMsg = errorObj.message.replace(/deepseek/gi, "AI");
      const { code, retryable } = detectErrorCodeAndRetryable(
        cleanMsg,
        typeof errorObj.code === "string" ? errorObj.code : undefined,
        typeof errorObj.retryable === "boolean" ? errorObj.retryable : undefined
      );

      return {
        code,
        message: cleanMsg,
        requestId: typeof errorObj.requestId === "string" ? errorObj.requestId : undefined,
        retryable,
        retryAfter: typeof errorObj.retryAfter === "number" ? errorObj.retryAfter : undefined,
      };
    }
  }

  if (typeof rawError === "string") {
    let cleanMsg = rawError.replace(/deepseek/gi, "AI");
    const { code, retryable } = detectErrorCodeAndRetryable(cleanMsg);
    return {
      code,
      message: cleanMsg.length > 0 ? cleanMsg : fallbackMessage,
      retryable,
    };
  }

  if (rawError instanceof Error) {
    let cleanMsg = rawError.message.replace(/deepseek/gi, "AI");
    const { code, retryable } = detectErrorCodeAndRetryable(cleanMsg);
    return {
      code,
      message: cleanMsg.length > 0 ? cleanMsg : fallbackMessage,
      retryable,
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    message: fallbackMessage,
    retryable: true,
  };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return normalizeClientError(error, fallback).message;
}
