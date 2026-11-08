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
import { detectAi } from "@/features/ai-detector";
import { createAiDetectDto } from "@/features/ai-detector/ai-detector.dto";
import { createNormalizedErrorResponse } from "@/lib/server-error";
import { parseAndValidateApiRequest } from "@/lib/api-route-helpers";

export const runtime = "nodejs";
export const maxDuration = 15;

async function handlePOST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let jobId: string | undefined;

  try {
    const parsed = await parseAndValidateApiRequest(
      req,
      "ai-detector",
      requestId,
      createAiDetectDto,
    );
    if (!parsed.success) {
      return parsed.response;
    }

    const { data, requestContext, rateLimitHeaders } = parsed;

    jobId = await startAiJob({
      context: requestContext,
      type: "AI_DETECTOR",
      input: { text: data.text },
    });

    const result = detectAi({ text: data.text });

    await completeAiJob(jobId, result, {
      model: "decision-based",
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
      tool: "ai-detector",
      requestId,
    });
  }
}

export const POST = withDatabaseScope(handlePOST);
