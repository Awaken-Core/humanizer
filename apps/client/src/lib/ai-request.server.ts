if (typeof window !== "undefined") {
  throw new Error("This module can only be executed on the server.");
}

import { Types } from "mongoose";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { client } from "@/lib/db";
import { creditCollections, CreditRequiredError } from "@/lib/credits.server";
import { BillingError, boardRates, estimateBoardRun, finishBoardRun } from "@/lib/board-billing.server";
import { env } from "@/lib/env";
import { AiJob } from "@/modal/ai";
import { Document } from "@/modal/document";
import { DocumentIdParamsDto } from "@/features/documents/document.dto";

export interface AiRequestContext {
  userId?: string;
  anonymousId?: string;
  isAuthenticated: boolean;
  rateLimitIdentifier: string;
  documentId?: string;
  idempotencyKey?: string;
  inputSource?: "document" | "selection";
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function getAiRequestContext(
  req: NextRequest,
): Promise<AiRequestContext> {
  const session = await (await getAuth()).api.getSession({ headers: req.headers });
  if (session?.user.id) {
    const requestedDocumentId = req.headers.get("x-document-id")?.trim();
    let documentId: string | undefined;
    const documentParams = DocumentIdParamsDto.safeParse({
      documentId: requestedDocumentId,
    });
    if (documentParams.success) {
      await client();
      const ownedDocument = await Document.exists({
        _id: documentParams.data.documentId,
        ownerId: session.user.id,
      });
      if (ownedDocument) documentId = documentParams.data.documentId;
    }
    if (requestedDocumentId !== undefined && !documentId) {
      throw new BillingError(404, "DOCUMENT_NOT_FOUND", "Board document was not found.");
    }
    const idempotencyKey = req.headers.get("x-idempotency-key") ?? undefined;
    if (documentId && idempotencyKey && !/^[a-zA-Z0-9_-]{1,100}$/.test(idempotencyKey)) {
      throw new BillingError(400, "INVALID_IDEMPOTENCY_KEY", "Invalid request identifier.");
    }
    const requestedInputSource = req.headers.get("x-tool-input-source");
    return {
      userId: session.user.id,
      isAuthenticated: true,
      rateLimitIdentifier: `user:${session.user.id}`,
      documentId,
      idempotencyKey,
      inputSource:
        requestedInputSource === "selection" ? "selection" : "document",
    };
  }

  if (req.headers.has("x-document-id")) throw new CreditRequiredError(401);
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
  type:
    | "AI_HUMANIZER"
    | "AI_SUMMARIZER"
    | "PARAPHRASER"
    | "PLAGIARISM_CHECKER"
    | "AI_DETECTOR"
    | "GRAMMAR_CHECKER";
  input: {
    text: string;
    mode?: string;
    intensity?: string;
    tone?: string;
    focus?: string;
  };
}

export async function startAiJob({
  context,
  type,
  input,
}: StartJobInput): Promise<string> {
  await client();
  const inputJob = {
    userId: context.userId,
    anonymousId: context.anonymousId,
    source: "WORKSPACE",
    ...(context.documentId
      ? { source: "BOARD", documentId: context.documentId }
      : {}),
    type,
    status: "PROCESSING",
    input: {
      content: input.text,
      mode: input.mode?.toLowerCase(),
      intensity: input.intensity?.toLowerCase(),
      tone: input.tone?.toLowerCase(),
      focus: input.focus?.toLowerCase(),
      options: context.documentId
        ? { inputSource: context.inputSource || "document" }
        : {},
    },
    startedAt: new Date(),
  };
  if (!context.documentId) return String((await AiJob.create(inputJob))._id);

  const userId = context.userId;
  if (!userId) throw new CreditRequiredError(401);
  const { connection, wallets, runs } = await creditCollections();
  const rates = type === "AI_DETECTOR" ? { inputRate: 0, outputRate: 0 } : boardRates();
  const reserved = estimateBoardRun(type, input.text, rates);
  const jobId = context.idempotencyKey
    ? createHash("sha256").update(JSON.stringify([userId, context.idempotencyKey])).digest("hex").slice(0, 24)
    : new Types.ObjectId().toHexString();
  try {
    return await connection.transaction(async (session) => {
      if (await runs.findOne({ _id: jobId }, { session, projection: { _id: 1 } })) {
        throw new BillingError(409, "DUPLICATE_BOARD_RUN", "This Board request was already submitted.");
      }
      const debit = await wallets.updateOne(
        { _id: userId, balance: { $gte: Math.max(1, reserved) } },
        { $inc: { balance: -reserved } },
        { session },
      );
      if (!debit.matchedCount) throw new CreditRequiredError(402);
      await runs.insertOne({ _id: jobId, userId, status: "reserved", reserved, ...rates, createdAt: new Date() }, { session });
      await AiJob.create([{ ...inputJob, _id: jobId, idempotencyKey: context.idempotencyKey }], { session });
      return jobId;
    });
  } catch (error) {
    if (context.idempotencyKey && (error as { code?: number })?.code === 11000) {
      throw new BillingError(409, "DUPLICATE_BOARD_RUN", "This Board request was already submitted.");
    }
    throw error;
  }
}

export async function completeAiJob(
  jobId: string,
  result: unknown,
  metadata: {
    model: string;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    boardUsage?: import("@/lib/board-billing.server").BoardUsage;
  },
): Promise<void> {
  if (metadata.boardUsage) {
    await finishBoardRun(jobId, { result, metadata, usage: metadata.boardUsage });
    return;
  }
  try {
    await AiJob.updateOne(
      { _id: jobId, status: "PROCESSING" },
      {
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
      },
    );
  } catch (error) {
    console.error("Failed to mark AI job as completed:", error);
  }
}

export async function failAiJob(jobId: string, error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    const failure = {
      status: "FAILED",
      error: { code: "PROCESSING_FAILED", message },
      completedAt: new Date(),
    };
    if (await finishBoardRun(jobId, { failure })) return;
    const job = await AiJob.findById(jobId).select("creditReserved").lean();
    if (!job?.creditReserved) {
      await AiJob.updateOne({ _id: jobId, status: "PROCESSING" }, { $set: failure });
      return;
    }
    const { connection, wallets } = await creditCollections();
    await connection.transaction(async (session) => {
      const reserved = await AiJob.findOneAndUpdate(
        { _id: jobId, status: "PROCESSING", creditReserved: true },
        { $set: { ...failure, creditReserved: false } },
        { session },
      );
      if (reserved?.userId) {
        await wallets.updateOne({ _id: reserved.userId }, { $inc: { balance: 1 } }, { session });
      }
    });
  } catch (updateError) {
    console.error("Failed to mark AI job as failed:", updateError);
  }
}
