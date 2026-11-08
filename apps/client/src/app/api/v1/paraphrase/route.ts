import { withDatabaseScope } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { HumanizerError } from "@/features/humanizer";
import { paraphraseText } from "@/features/paraphraser";
import { createParaphraseTextInputSchema } from "@/features/paraphraser/paraphraser.dto";
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
      "paraphraser",
      requestId,
      createParaphraseTextInputSchema,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "PARAPHRASER",
      input: {
        text: data.text,
        tone: data.tone,
        focus: data.focus,
      },
    });

    const result = await paraphraseText(data);
    await completeAiJob(
      jobId,
      { content: result.paraphrasedText },
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
          paraphrasedText: result.paraphrasedText,
          selectedTone: result.selectedTone.toLowerCase(),
          selectedFocus: result.selectedFocus.toLowerCase(),
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
      tool: "paraphraser",
      requestId,
      status: error instanceof HumanizerError ? error.status : undefined,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
