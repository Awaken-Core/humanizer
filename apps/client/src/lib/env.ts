import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export const env = createEnv({
  emptyStringAsUndefined: true,
  server: {
    BOARD_INPUT_MICROCREDITS_PER_1K_TOKENS: z.coerce.number().int().positive().max(1_000_000_000).optional(),
    BOARD_OUTPUT_MICROCREDITS_PER_1K_TOKENS: z.coerce.number().int().positive().max(1_000_000_000).optional(),
    BOARD_DEFAULT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(1_000_000).default(384_000),
    DODO_PAYMENTS_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).default("test_mode"),
    DODO_PAYMENTS_API_KEY: z.string().optional(),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().optional(),
    DODO_PAYMENTS_PRODUCT_ID: z.string().optional(),
    DODO_PAYMENTS_PACK_CREDITS: z.coerce.number().int().positive().max(1_000_000).optional(),
    MONGODB_URI: z.string().min(1),
    NODE_ENV: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    POSTHOG_PROJECT_ID: z.string().optional(),
    POSTHOG_API_KEY: z.string().optional(),
    // Set to "true" to require email verification before a user can vote.
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().min(1).optional(),
    DEEPSEEK_MODEL: z.string().default("deepseek-flash"),
    DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
    // Serper web search (used by plagiarism retrieval — optional, graceful fallback if absent)
    SERPER_API_KEY: z.string().optional(),
    SERPER_BASE_URL: z.string().url().default("https://google.serper.dev"),

  },
  client: {
    NEXT_PUBLIC_APP_BASE_URL: z.url(),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().default("G-ZRCZZHY7JS"),
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  // Build without production secrets; validate again in the deployed runtime.
  skipValidation:
    process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD ||
    !!process.env.SKIP_ENV_VALIDATION,
});
