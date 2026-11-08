import { withDatabaseScope } from "@/lib/db";
if (typeof window !== "undefined") {
  throw new Error("This module can only be executed on the server.");
}

import { NextRequest, NextResponse } from "next/server";
import {
  startAiJob,
  completeAiJob,
  failAiJob,
} from "@/lib/ai-request.server";
import { checkGrammar } from "@/features/grammar";
import { createGrammarInputDto } from "@/features/grammar/grammar.dto";
import { createNormalizedErrorResponse } from "@/lib/server-error";
import { parseAndValidateApiRequest } from "@/lib/api-route-helpers";

export const runtime = "nodejs";
export const maxDuration = 45;

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let jobId: string | undefined;

  try {
    const parsed = await parseAndValidateApiRequest(
      req,
      "grammar-checker",
      requestId,
      createGrammarInputDto,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "GRAMMAR_CHECKER",
      input: { text: data.text },
    });

    const result = await checkGrammar({ text: data.text });

    await completeAiJob(jobId, result, {
      model: "deterministic+deepseek",
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { success: true, data: result },
      {
        status: 200,
        headers: {
          "X-Request-Id": requestId,
          ...rateLimitHeaders,
        },
      },
    );
  } catch (error) {
    if (jobId) await failAiJob(jobId, error);
    return createNormalizedErrorResponse(error, {
      tool: "grammar-checker",
      requestId,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
