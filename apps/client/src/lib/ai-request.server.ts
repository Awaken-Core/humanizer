import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { client } from "@/lib/db";
import { env } from "@/lib/env";
import { AiJob } from "@/modal/ai";

export interface AiRequestContext {
  userId?: string;
  anonymousId?: string;
  isAuthenticated: boolean;
  rateLimitIdentifier: string;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function getAiRequestContext(req: NextRequest): Promise<AiRequestContext> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session?.user.id) {
    return {
      userId: session.user.id,
      isAuthenticated: true,
      rateLimitIdentifier: `user:${session.user.id}`,
    };
  }

  const anonymousId = createHash("sha256")
    .update(`${env.BETTER_AUTH_SECRET}:${getClientIp(req)}`)
    .digest("hex");
  return {
    anonymousId,
    isAuthenticated: false,
    rateLimitIdentifier: `anonymous:${anonymousId}`,
  };
}

interface StartJobInput {
  context: AiRequestContext;
  type: "AI_HUMANIZER" | "AI_SUMMARIZER";
  input: { text: string; mode: string; intensity: string };
}

export async function startAiJob({ context, type, input }: StartJobInput): Promise<string> {
  await client();
  const job = await AiJob.create({
    userId: context.userId,
    anonymousId: context.anonymousId,
    source: "WORKSPACE",
    type,
    status: "PROCESSING",
    input: {
      content: input.text,
      mode: input.mode.toLowerCase(),
      intensity: input.intensity.toLowerCase(),
    },
    startedAt: new Date(),
  });
  return String(job._id);
}

export async function completeAiJob(
  jobId: string,
  result: unknown,
  metadata: {
    model: string;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
  }
): Promise<void> {
  try {
    await AiJob.updateOne({ _id: jobId }, {
      $set: {
        status: "COMPLETED",
        result,
        model: { name: metadata.model },
        metrics: {
          processingTime: metadata.durationMs,
          inputTokens: metadata.promptTokens,
          outputTokens: metadata.completionTokens,
        },
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to mark AI job as completed:", error);
  }
}

export async function failAiJob(jobId: string, error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    await AiJob.updateOne({ _id: jobId }, {
      $set: {
        status: "FAILED",
        error: { code: "PROCESSING_FAILED", message },
        completedAt: new Date(),
      },
    });
  } catch (updateError) {
    console.error("Failed to mark AI job as failed:", updateError);
  }
}
