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

/**
 * POST /api/v1/plagiarism
 * Thin endpoint orchestrating validation, rate-limiting, authentication, and
 * plagiarism analysis execution.
 */
async function handlePOST(req: NextRequest) {
  let jobId: string | undefined;

  try {
    // 1. Content-Type Validation
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
        { status: 415 },
      );
    }

    // 2. Parse JSON Body
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
        { status: 400 },
      );
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

      return NextResponse.json(
        {
          success: false,
          error: {
            code: isLengthError ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
            message,
          },
        },
        { status: isLengthError ? 413 : 400 },
      );
    }

    // 4. Rate limiting
    const rateLimit = await checkRateLimit(
      requestContext.rateLimitIdentifier,
      requestContext.isAuthenticated,
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
        { status: 503 },
      );
    }

    if (!rateLimit.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rateLimit.reset - Date.now()) / 1000),
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
        },
      );
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

    // Map PlagiarismError subclasses to their status codes
    if (error instanceof PlagiarismError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    // Timeout detection
    const errMessage = error instanceof Error ? error.message : String(error);
    if (
      errMessage.toLowerCase().includes("timeout") ||
      errMessage.toLowerCase().includes("timed out")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAGIARISM_TIMEOUT",
            message:
              "The plagiarism check timed out. Please try again with shorter text.",
          },
        },
        { status: 504 },
      );
    }

    console.error("Unhandled error in /api/v1/plagiarism:", errMessage);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            "An unexpected error occurred while processing your request.",
        },
      },
      { status: 500 },
    );
  }
}

export const POST = withDatabaseScope(handlePOST);
