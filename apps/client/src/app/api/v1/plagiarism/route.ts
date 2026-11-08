import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/ratelimit";
import { checkPlagiarism, PlagiarismError } from "@/features/plagiarism";
import { createPlagiarismInputSchema } from "@/features/plagiarism/plagiarism.dto";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.dto";
import {
  completeAiJob,
  failAiJob,
  getAiRequestContext,
  startAiJob,
} from "@/lib/ai-request.server";
import { client } from "@/lib/db";
import { PlagiarismReport } from "@/modal/plagiarism-report";
import { createNormalizedErrorResponse } from "@/lib/server-error";

export const maxDuration = 60;

/**
 * POST /api/v1/plagiarism
 * Thin endpoint orchestrating validation, rate-limiting, authentication, and
 * plagiarism analysis execution.
 */
async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;

  try {
    // 1. Content-Type Validation
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return createNormalizedErrorResponse(new Error("Content-Type must be application/json."), {
        tool: "plagiarism-checker",
        requestId,
        status: 415,
        overrideCode: "UNSUPPORTED_MEDIA_TYPE",
      });
    }

    // 2. Parse JSON Body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createNormalizedErrorResponse(new Error("Request body contains invalid or malformed JSON."), {
        tool: "plagiarism-checker",
        requestId,
        status: 400,
        overrideCode: "INVALID_JSON",
      });
    }

    // 3. Auth context + length limit selection
    const requestContext = await getAiRequestContext(req);
    const maxInputLength = requestContext.isAuthenticated
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;

    const parseResult =
      createPlagiarismInputSchema(maxInputLength).safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue?.message || "Invalid input parameters.";
      const isLengthError =
        issue?.code === "too_big" ||
        message.includes(maxInputLength.toLocaleString());

      return createNormalizedErrorResponse(new Error(message), {
        tool: "plagiarism-checker",
        requestId,
        status: isLengthError ? 413 : 400,
        overrideCode: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
        overrideMessage: message,
      });
    }

    // 4. Rate limiting
    const rateLimit = await checkRateLimit(
      requestContext.rateLimitIdentifier,
      requestContext.isAuthenticated,
    );

    if (rateLimit.serviceUnavailable) {
      return createNormalizedErrorResponse(new Error("Rate limiting service unavailable."), {
        tool: "plagiarism-checker",
        requestId,
        status: 503,
        overrideCode: "SERVICE_UNAVAILABLE",
        overrideMessage: "Rate limiting service is temporarily unavailable. Please try again shortly.",
      });
    }

    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000),
      );
      return createNormalizedErrorResponse(new Error("Rate limit exceeded."), {
        tool: "plagiarism-checker",
        requestId,
        status: 429,
        overrideCode: "APP_RATE_LIMIT_EXCEEDED",
        overrideMessage: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
      });
    }

    // 5. Start AI job
    jobId = await startAiJob({
      context: requestContext,
      type: "PLAGIARISM_CHECKER",
      input: { text: parseResult.data.text },
    });

    // 6. Run plagiarism check
    const result = await checkPlagiarism(parseResult.data);

    // 7. Mark job as completed
    await completeAiJob(
      jobId,
      {
        scores: result.scores,
        wordCount: result.wordCount,
        sentenceCount: result.sentenceCount,
        processingTimeMs: result.processingTimeMs,
      },
      {
        model: "retrieval+scoring",
        durationMs: result.processingTimeMs,
      },
    );

    // 8. Persist plagiarism report to MongoDB
    await client();
    const report = await PlagiarismReport.create({
      jobId,
      userId: requestContext.userId,
      anonymousId: requestContext.anonymousId,
      overallSimilarity: result.scores.overallSimilarity,
      identicalScore: result.scores.identicalScore,
      paraphrasedScore: result.scores.paraphrasedScore,
      quotedScore: result.scores.quotedScore,
      originalScore: result.scores.originalScore,
      wordCount: result.wordCount,
      sentenceCount: result.sentenceCount,
      sources: result.sources.map((s) => ({
        url: s.url,
        title: s.title,
        domain: s.domain,
        author: s.author,
        publishDate: s.publishDate,
        matchPercentage: s.matchPercentage,
        matchedWordCount: s.matchedWordCount,
        isExcluded: s.isExcluded,
        retrievedAt: s.retrievedAt,
      })),
      matches: result.matches,
      settings: result.settings,
      summary: result.summary,
      status: "completed",
      processingTimeMs: result.processingTimeMs,
    });

    // 9. Success Response
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          reportId: String(report._id),
          scores: result.scores,
          sources: result.sources.map((s) => ({
            url: s.url,
            title: s.title,
            domain: s.domain,
            author: s.author,
            publishDate: s.publishDate,
            matchPercentage: s.matchPercentage,
            matchedWordCount: s.matchedWordCount,
            isExcluded: s.isExcluded,
            retrievedAt: s.retrievedAt,
          })),
          matches: result.matches,
          wordCount: result.wordCount,
          sentenceCount: result.sentenceCount,
          summary: result.summary,
          processingTimeMs: result.processingTimeMs,
          settings: result.settings,
        },
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  } catch (error: unknown) {
    if (jobId) await failAiJob(jobId, error);
    return createNormalizedErrorResponse(error, {
      tool: "plagiarism-checker",
      requestId,
      status: error instanceof PlagiarismError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
