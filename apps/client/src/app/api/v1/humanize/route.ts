import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { humanizeText, HumanizerError } from "@/features/humanizer";
import { createHumanizeTextInputSchema } from "@/features/humanizer/humanizer.dto";
import {
  completeAiJob,
  failAiJob,
  startAiJob,
} from "@/lib/ai-request.server";
import { createNormalizedErrorResponse } from "@/lib/server-error";
import { parseAndValidateApiRequest } from "@/lib/api-route-helpers";

export const maxDuration = 60;

/**
 * POST /api/v1/humanize
 * Orchestrates validation, rate-limiting, authentication, and execution with full header transparency.
 */
async function handlePOST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  let jobId: string | undefined;
  try {
    const parsed = await parseAndValidateApiRequest(
      req,
      "humanizer",
      requestId,
      createHumanizeTextInputSchema,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "AI_HUMANIZER",
      input: {
        text: data.text,
        mode: data.mode,
        intensity: data.intensity,
      },
    });

    const result = await humanizeText(data);
    await completeAiJob(
      jobId,
      {
        content: result.humanizedText,
        detectedLanguage: result.detectedLanguage,
      },
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
          humanizedText: result.humanizedText,
          detectedLanguage: result.detectedLanguage,
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
      tool: "humanizer",
      requestId,
      status: error instanceof HumanizerError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
