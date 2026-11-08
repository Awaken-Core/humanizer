import { z } from "zod";

export const StandardApiErrorDetailDto = z.object({
  code: z.string().default("INTERNAL_ERROR"),
  message: z.string().default("An unexpected error occurred. Please try again."),
  requestId: z.string().optional(),
  retryable: z.boolean().default(true),
  retryAfter: z.number().optional(),
});

export type StandardApiErrorDetail = z.infer<typeof StandardApiErrorDetailDto>;

export const ToolApiResponseDto = z
  .object({
    success: z.boolean().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    error: z.union([z.string(), StandardApiErrorDetailDto, z.record(z.string(), z.unknown())]).optional(),
  })
  .passthrough();

export interface NormalizedClientError {
  code: string;
  message: string;
  requestId?: string;
  retryable: boolean;
  retryAfter?: number;
}

/**
 * Sanitizes and normalizes any client-side error (fetch error, HTTP 4xx/5xx, AbortError, JSON parse error).
 * Guarantees zero leakage of internal provider names or raw technical details.
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

    // If it's already a structured StandardApiErrorDetail
    if (typeof errorObj.message === "string" && typeof errorObj.code === "string") {
      let cleanMsg = errorObj.message;
      // Safety filter: scrub vendor names if ever returned accidentally
      cleanMsg = cleanMsg.replace(/deepseek/gi, "AI");
      return {
        code: String(errorObj.code),
        message: cleanMsg,
        requestId: typeof errorObj.requestId === "string" ? errorObj.requestId : undefined,
        retryable: typeof errorObj.retryable === "boolean" ? errorObj.retryable : true,
        retryAfter: typeof errorObj.retryAfter === "number" ? errorObj.retryAfter : undefined,
      };
    }

    if (errorObj.error) {
      return normalizeClientError(errorObj.error, fallbackMessage);
    }
  }

  if (typeof rawError === "string") {
    let cleanMsg = rawError.replace(/deepseek/gi, "AI");
    return {
      code: "UNKNOWN_ERROR",
      message: cleanMsg.length > 0 ? cleanMsg : fallbackMessage,
      retryable: true,
    };
  }

  if (rawError instanceof Error) {
    let cleanMsg = rawError.message.replace(/deepseek/gi, "AI");
    return {
      code: "CLIENT_ERROR",
      message: cleanMsg.length > 0 ? cleanMsg : fallbackMessage,
      retryable: true,
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
