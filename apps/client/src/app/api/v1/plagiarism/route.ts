import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { checkPlagiarism, PlagiarismError } from "@/features/plagiarism";
import { createPlagiarismInputSchema } from "@/features/plagiarism/plagiarism.dto";
import {
  completeAiJob,
  failAiJob,
  startAiJob,
} from "@/lib/ai-request.server";
import { client } from "@/lib/db";
import { PlagiarismReport } from "@/modal/plagiarism-report";
import { createNormalizedErrorResponse } from "@/lib/server-error";
import { parseAndValidateApiRequest } from "@/lib/api-route-helpers";

export const maxDuration = 60;

/**
 * POST /api/v1/plagiarism
 * Orchestrates validation, rate-limiting, authentication, and execution.
 */
async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;

  try {
    const parsed = await parseAndValidateApiRequest(
      req,
      "plagiarism-checker",
      requestId,
      createPlagiarismInputSchema,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "PLAGIARISM_CHECKER",
      input: { text: data.text },
    });

    const result = await checkPlagiarism(data);

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
          "X-Request-Id": requestId,
          ...rateLimitHeaders,
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
