import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
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
  },
  client: {
    NEXT_PUBLIC_APP_BASE_URL: z.url(),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().default("G-ZRCZZHY7JS"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
