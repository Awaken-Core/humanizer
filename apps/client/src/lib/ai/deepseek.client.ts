// Protect against accidental browser imports
if (typeof window !== "undefined") {
  throw new Error("DeepSeek client can only be used on the server.");
}

// In Next.js bundling contexts, ensure React Server Component boundaries
if (process.env.NEXT_RUNTIME || process.env.NODE_ENV === "production") {
  try {
    // Dynamic import to satisfy bundler server-only checks while allowing node/bun scripts to execute
    require("server-only");
  } catch {
    // ignore outside of React Server bundler
  }
}

import OpenAI from "openai";
import { env } from "@/lib/env";

let deepseekClientInstance: OpenAI | null = null;

export interface DeepSeekClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Returns a lazily initialized, server-only OpenAI SDK client configured for DeepSeek.
 * Validates DEEPSEEK_API_KEY when first called.
 */
export function getDeepSeekClient(options?: DeepSeekClientOptions): OpenAI {
  const apiKey = env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DeepSeek API key is missing. Please set DEEPSEEK_API_KEY in your environment (.env.local)."
    );
  }

  // If custom options are passed for a specific run, return an instance configured with them
  if (options?.timeoutMs !== undefined || options?.maxRetries !== undefined) {
    return new OpenAI({
      apiKey,
      baseURL: env.DEEPSEEK_BASE_URL,
      timeout: options.timeoutMs ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
    });
  }

  if (!deepseekClientInstance) {
    deepseekClientInstance = new OpenAI({
      apiKey,
      baseURL: env.DEEPSEEK_BASE_URL,
      timeout: 30_000,
      maxRetries: 2,
    });
  }

  return deepseekClientInstance;
}

export const DEEPSEEK_CONFIG = {
  get defaultModel() {
    return env.DEEPSEEK_MODEL;
  },
  get baseURL() {
    return env.DEEPSEEK_BASE_URL;
  },
} as const;
