import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Rate limit configuration constants
 */
export const RATE_LIMIT_CONFIG = {
  // Authenticated users: 20 requests per 1-minute sliding window
  authenticated: {
    limit: 20,
    window: "60 s" as const,
  },
  // Anonymous / IP-based: 5 requests per 1-minute sliding window
  anonymous: {
    limit: 5,
    window: "60 s" as const,
  },
} as const;

let redisClient: Redis | null = null;
let userRatelimit: Ratelimit | null = null;
let ipRatelimit: Ratelimit | null = null;

function getRedisInstance(): Redis | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url,
      token,
    });
  }

  return redisClient;
}

/**
 * Returns rate-limiter instances if Upstash Redis credentials are configured.
 */
function getRateLimiters(): {
  userLimiter: Ratelimit | null;
  ipLimiter: Ratelimit | null;
} {
  const redis = getRedisInstance();
  if (!redis) {
    return { userLimiter: null, ipLimiter: null };
  }

  if (!userRatelimit) {
    userRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.authenticated.limit,
        RATE_LIMIT_CONFIG.authenticated.window
      ),
      analytics: true,
      prefix: "ratelimit:humanizer:user",
    });
  }

  if (!ipRatelimit) {
    ipRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.anonymous.limit,
        RATE_LIMIT_CONFIG.anonymous.window
      ),
      analytics: true,
      prefix: "ratelimit:humanizer:ip",
    });
  }

  return { userLimiter: userRatelimit, ipLimiter: ipRatelimit };
}

export interface RateLimitCheckResult {
  isConfigured: boolean;
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  serviceUnavailable?: boolean;
}

/**
 * Checks rate limits for a given identifier (User ID or client IP address).
 * Explicit Policy:
 * - Production: If Redis is unconfigured or encounters a fatal connection failure,
 *   fail-closed with serviceUnavailable: true (HTTP 503) to protect upstream DeepSeek API.
 * - Development: Allow fail-open behavior when Redis credentials are not set.
 */
export async function checkRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<RateLimitCheckResult> {
  const isProduction =
    process.env.NODE_ENV === "production" &&
    !process.env.ALLOW_UNLIMITED_IN_PRODUCTION;

  const { userLimiter, ipLimiter } = getRateLimiters();
  const limiter = isAuthenticated ? userLimiter : ipLimiter;

  // If Upstash Redis is not configured:
  if (!limiter) {
    if (isProduction) {
      console.error(
        "Production rate limiting failure: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured."
      );
      return {
        isConfigured: false,
        success: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
        serviceUnavailable: true,
      };
    }

    // In development/test, allow fail-open
    return {
      isConfigured: false,
      success: true,
      limit: isAuthenticated
        ? RATE_LIMIT_CONFIG.authenticated.limit
        : RATE_LIMIT_CONFIG.anonymous.limit,
      remaining: 999,
      reset: Date.now() + 60_000,
    };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      isConfigured: true,
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Upstash Redis rate limit check error:", error);

    if (isProduction) {
      // In production, fail-closed on active rate-limiter failure
      return {
        isConfigured: true,
        success: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
        serviceUnavailable: true,
      };
    }

    // In development, gracefully continue
    return {
      isConfigured: true,
      success: true,
      limit: isAuthenticated
        ? RATE_LIMIT_CONFIG.authenticated.limit
        : RATE_LIMIT_CONFIG.anonymous.limit,
      remaining: 1,
      reset: Date.now() + 60_000,
    };
  }
}
