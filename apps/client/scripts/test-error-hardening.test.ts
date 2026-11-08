process.env.SKIP_ENV_VALIDATION = "1";

import { describe, it, expect } from "bun:test";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import {
  classifyError,
  createNormalizedErrorResponse,
  sanitizeLogData,
} from "../src/lib/server-error";
import { normalizeClientError } from "../src/lib/api.dto";
import { checkGrammar } from "../src/features/grammar";
import { generatePlagiarismSummary } from "../src/features/plagiarism/plagiarism.reporter";

describe("Phase 1: Production Error Hardening Test Suite", () => {
  // Test 1: Full UUID and Sanitized Error Classification
  it("generates full UUID request IDs and properly classifies errors", () => {
    const error = new Error("DeepSeek API Error: 429 rate limit exceeded. Retry after 12s. apiKey: sk-abcdef12345678901234");
    const classification = classifyError(error, 429);

    expect(classification.code).toBe("APP_RATE_LIMIT_EXCEEDED");
    expect(classification.status).toBe(429);
    expect(classification.retryable).toBe(true);

    const response = createNormalizedErrorResponse(error, {
      tool: "humanizer",
    });

    expect(response.status).toBe(429);
    const headers = response.headers;
    const reqId = headers.get("X-Request-Id");
    expect(reqId).toBeDefined();
    // Validate full UUID format (36 characters with dashes)
    expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  // Test 2: Provider 401/403 Authentication/Key Failure Masking
  it("masks provider 401/403 configuration failures without exposing credentials", async () => {
    const error = new Error("Authentication failed: invalid DeepSeek API key sk-live-secret-key-12345");
    const classification = classifyError(error, 401);

    expect(classification.code).toBe("AI_SERVICE_UNAVAILABLE");
    expect(classification.status).toBe(503);
    expect(classification.retryable).toBe(false);

    const response = createNormalizedErrorResponse(error, {
      tool: "paraphraser",
      status: classification.status,
    });

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("AI_SERVICE_UNAVAILABLE");
    expect(body.error.message).toBe("Our AI writing service is temporarily unavailable. Please try again shortly.");

    // Critical leak assertions
    expect(JSON.stringify(body)).not.toContain("DeepSeek");
    expect(JSON.stringify(body)).not.toContain("sk-");
    expect(JSON.stringify(body)).not.toContain("API key");
  });

  // Test 3: Log Sanitization
  it("scrubs sensitive keys, tokens, DB urls, and user text in internal logs", () => {
    const dirtyData = {
      apiKey: "sk-12345678901234567890",
      authorization: "Bearer my-secret-jwt-token-abcdef",
      mongoUri: "mongodb+srv://admin:p@ssword@cluster.mongodb.net/test",
      text: "This is a sensitive user draft paper that must not be logged entirely.",
      regularField: "hello world",
    };

    const sanitized = sanitizeLogData(dirtyData) as Record<string, unknown>;
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(String(sanitized.mongoUri)).toContain("[REDACTED");
    expect(sanitized.text).toContain("[TEXT_OMITTED: length=");
    expect(sanitized.regularField).toBe("hello world");
  });

  // Test 4: Frontend Client Error Normalization
  it("normalizes client errors and prevents vendor leaks", () => {
    // AbortError
    const abortErr = new DOMException("The user aborted a request.", "AbortError");
    const normalizedAbort = normalizeClientError(abortErr);
    expect(normalizedAbort.code).toBe("REQUEST_ABORTED");
    expect(normalizedAbort.message).toContain("cancelled");

    // Network error
    const netErr = new TypeError("Failed to fetch");
    const normalizedNet = normalizeClientError(netErr);
    expect(normalizedNet.code).toBe("NETWORK_ERROR");

    // DeepSeek raw string leak filtering
    const rawLeak = "DeepSeek service returned 500 internal server error";
    const normalizedLeak = normalizeClientError(rawLeak);
    expect(normalizedLeak.message).not.toContain("DeepSeek");
    expect(normalizedLeak.message).toContain("AI service returned 500");
  });

  // Test 5: Tool Fallbacks Preservation (Grammar and Plagiarism)
  it("preserves fallback mechanisms in grammar and plagiarism tools", async () => {
    // Grammar check on text with punctuation flaws should return valid corrections
    const textWithTypos = "This is a test  sentence ,with punctuation spacing issues.";
    const grammarResult = await checkGrammar({ text: textWithTypos });

    expect(grammarResult).toBeDefined();
    expect(grammarResult.issues.length).toBeGreaterThan(0);
    expect(grammarResult.score).toBeGreaterThan(0);
    expect(grammarResult.correctedText).toBeDefined();

    // Plagiarism fallback summary generation with mock scores
    const mockScores = {
      overallSimilarity: 12,
      identicalScore: 5,
      paraphrasedScore: 7,
      originalScore: 88,
    };
    const mockSources = [
      {
        url: "https://example.com/source",
        domain: "example.com",
        title: "Example Title",
        matchedWordCount: 15,
        matchPercentage: 12,
        isExcluded: false,
      },
    ];

    const summary = await generatePlagiarismSummary(mockScores, mockSources, 150);
    expect(summary).toBeDefined();
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(50);
    expect(summary).toMatch(/12\s*(%|percent)/i);
  }, 15000);

  // Test 6: Sensitive String Leak Test on Error Responses
  it("proves that no vendor names, tokens, or stack traces appear in error responses", async () => {
    const errorTypes = [
      new Error("DeepSeek 429 Too Many Requests"),
      new Error("Error calling https://api.deepseek.com/chat/completions: 502 Bad Gateway"),
      new Error("Invalid API key provided: sk-abcdefghijklmnopqrstuvwxyz123"),
      new Error("DB Connection Error: mongodb+srv://user:pass@cluster0.net"),
    ];

    for (const err of errorTypes) {
      const response = createNormalizedErrorResponse(err, { tool: "test-tool" });
      const body = await response.json();
      const stringified = JSON.stringify(body);

      // Assert forbidden strings
      expect(stringified).not.toMatch(/deepseek/i);
      expect(stringified).not.toMatch(/sk-[a-zA-Z0-9]{15,}/);
      expect(stringified).not.toMatch(/mongodb(\+srv)?:\/\//);
      expect(stringified).not.toMatch(/at Object\./);
      expect(stringified).not.toMatch(/node_modules/);
    }
  });

  // Test 7: All 6 Tool Route Handlers Return Standard Normalized Error Envelopes
  it("verifies all six API routes independently return normalized envelopes with full UUIDs", async () => {
    const { POST: humanizePost } = await import("../src/app/api/v1/humanize/route");
    const { POST: aiDetectPost } = await import("../src/app/api/v1/ai-detect/route");
    const { POST: paraphrasePost } = await import("../src/app/api/v1/paraphrase/route");
    const { POST: summarizePost } = await import("../src/app/api/v1/summarize/route");
    const { POST: plagiarismPost } = await import("../src/app/api/v1/plagiarism/route");
    const { POST: grammarPost } = await import("../src/app/api/v1/grammar/route");

    const routes = [
      { name: "humanize", handler: humanizePost, url: "http://localhost:3000/api/v1/humanize" },
      { name: "ai-detect", handler: aiDetectPost, url: "http://localhost:3000/api/v1/ai-detect" },
      { name: "paraphrase", handler: paraphrasePost, url: "http://localhost:3000/api/v1/paraphrase" },
      { name: "summarize", handler: summarizePost, url: "http://localhost:3000/api/v1/summarize" },
      { name: "plagiarism", handler: plagiarismPost, url: "http://localhost:3000/api/v1/plagiarism" },
      { name: "grammar", handler: grammarPost, url: "http://localhost:3000/api/v1/grammar" },
    ];

    const { NextRequest } = await import("next/server");

    for (const route of routes) {
      // Send bad request with empty body
      const req = new NextRequest(route.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "" }),
      });

      const res = await route.handler(req);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(typeof body.error.code).toBe("string");
      expect(typeof body.error.message).toBe("string");
      expect(body.error.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      // Verify zero leak in serialized response
      const str = JSON.stringify(body);
      expect(str).not.toMatch(/deepseek/i);
      expect(str).not.toMatch(/sk-[a-zA-Z0-9]{15,}/);
      expect(str).not.toMatch(/mongodb(\+srv)?:\/\//);
      expect(str).not.toMatch(/node_modules/);
    }
  }, 15000);
});

