import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { HumanizerError } from "@/features/humanizer";
import { summarizeText } from "@/features/summarizer";
import { createHumanizeTextInputSchema } from "@/features/humanizer/humanizer.dto";
import {
  completeAiJob,
  failAiJob,
  startAiJob,
} from "@/lib/ai-request.server";
import { createNormalizedErrorResponse } from "@/lib/server-error";
import { parseAndValidateApiRequest } from "@/lib/api-route-helpers";

export const maxDuration = 45;

async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;
  try {
    const parsed = await parseAndValidateApiRequest(
      req,
      "summarizer",
      requestId,
      createHumanizeTextInputSchema,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "AI_SUMMARIZER",
      input: {
        text: data.text,
        mode: data.mode,
        intensity: data.intensity,
      },
    });

    const result = await summarizeText(data);
    await completeAiJob(
      jobId,
      { content: result.summaryText },
      {
        model: result.processingMetadata.model,
        durationMs: result.processingMetadata.durationMs,
        promptTokens: result.processingMetadata.tokens?.promptTokens,
        completionTokens: result.processingMetadata.tokens?.completionTokens,
      },
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          originalText: result.originalText,
          summaryText: result.summaryText,
          selectedMode: result.selectedMode.toLowerCase(),
          selectedIntensity: result.selectedIntensity.toLowerCase(),
          processingMetadata: {
            model: result.processingMetadata.model,
            duration: result.processingMetadata.durationMs,
            tokenUsage: result.processingMetadata.tokens
              ? {
                  promptTokens:
                    result.processingMetadata.tokens.promptTokens ?? 0,
                  completionTokens:
                    result.processingMetadata.tokens.completionTokens ?? 0,
                  totalTokens:
                    result.processingMetadata.tokens.totalTokens ?? 0,
                }
              : undefined,
          },
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
      tool: "summarizer",
      requestId,
      status: error instanceof HumanizerError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
