import { AsyncLocalStorage } from "node:async_hooks";
import type OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { AiJob } from "@/modal/ai";
import { creditCollections, CreditRequiredError } from "./credits.server";
import { env } from "./env";

type Rates = { inputRate: number; outputRate: number };
export type BoardUsage = { inputTokens: number; outputTokens: number; incomplete: boolean };
type InvocationScope = BoardUsage & { jobId: string; estimatedInput: number; estimatedOutput: number; blocked?: unknown };
const invocationScope = new AsyncLocalStorage<InvocationScope>();

export class BillingError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function boardRates(): Rates {
  const inputRate = env.BOARD_INPUT_MICROCREDITS_PER_1K_TOKENS;
  const outputRate = env.BOARD_OUTPUT_MICROCREDITS_PER_1K_TOKENS;
  if (!inputRate || !outputRate) {
    throw new BillingError(503, "BOARD_BILLING_UNAVAILABLE", "Board AI billing is not configured.");
  }
  return { inputRate, outputRate };
}

export function tokenCharge(input: number, output: number, rates: Rates) {
  const units = BigInt(input) * BigInt(rates.inputRate) + BigInt(output) * BigInt(rates.outputRate);
  return Number((units + 999_999_999n) / 1_000_000_000n);
}

const BOARD_HOLD_TIMEOUT_MS = 5 * 60_000;
const ANALYSIS_OUTPUT_TOKENS = 1_500;

export function humanizerRewriteOutputBudget(text: string, mode?: string) {
  const expansion = mode?.toLowerCase() === "academic" ? 1.5 : 1.25;
  return Math.max(1_600, Math.ceil(Buffer.byteLength(text) * expansion) + 1_024);
}

export function estimateBoardRun(type: string, text: string, rates: Rates, mode?: string) {
  const bytes = Buffer.byteLength(text);
  switch (type) {
    case "AI_DETECTOR":
      return 0;
    case "AI_HUMANIZER":
      return tokenCharge(2 * bytes + 6_000, ANALYSIS_OUTPUT_TOKENS + humanizerRewriteOutputBudget(text, mode), rates);
    case "AI_SUMMARIZER":
      return tokenCharge(bytes + 4_096, 2_000, rates);
    case "PARAPHRASER":
      return tokenCharge(bytes + 4_096, 3_000, rates);
    case "GRAMMAR_CHECKER":
      return tokenCharge(bytes + 4_096, 2_500, rates);
    case "PLAGIARISM_CHECKER":
      return tokenCharge(bytes + 8_192, 400, rates);
    default:
      throw new Error("Missing token estimate for Board tool.");
  }
}

export async function withBoardUsage<T>(jobId: string | undefined, run: () => T | Promise<T>) {
  if (!jobId) return { result: await run(), usage: undefined };
  const scope: InvocationScope = {
    jobId, inputTokens: 0, outputTokens: 0, incomplete: false,
    estimatedInput: 0, estimatedOutput: 0,
  };
  const result = await invocationScope.run(scope, run);
  if (scope.blocked) throw scope.blocked;
  return {
    result,
    usage: {
      inputTokens: scope.inputTokens,
      outputTokens: scope.outputTokens,
      incomplete: scope.incomplete,
    },
  };
}

export async function createTrackedCompletion(client: OpenAI, request: ChatCompletionCreateParamsNonStreaming, boardOutputLimit?: number) {
  const scope = invocationScope.getStore();
  if (!scope) return client.chat.completions.create(request);
  if (scope.blocked) throw scope.blocked;

  const outputLimit = boardOutputLimit ?? request.max_completion_tokens ?? request.max_tokens;
  if (!outputLimit) throw new Error("Missing Board provider output limit.");
  scope.estimatedInput += Buffer.byteLength(JSON.stringify(request.messages)) + 512;
  scope.estimatedOutput += outputLimit;

  try {
    const { connection, runs, wallets } = await creditCollections();
    await connection.transaction(async (session) => {
      const run = await runs.findOne({ _id: scope.jobId, status: "reserved" }, { session });
      if (!run) throw new Error("Board credit reservation is missing.");
      const required = tokenCharge(scope.estimatedInput, scope.estimatedOutput, run);
      const additional = required - run.reserved;
      if (additional > 0) {
        const debit = await wallets.updateOne(
          { _id: run.userId, balance: { $gte: additional } },
          { $inc: { balance: -additional } },
          { session },
        );
        if (!debit.modifiedCount) throw new CreditRequiredError(402);
      }
      await runs.updateOne({ _id: scope.jobId }, {
        $inc: { reserved: Math.max(0, additional) },
        $set: { lastActivityAt: new Date() },
      }, { session });
    });
  } catch (error) {
    scope.blocked = error;
    throw error;
  }

  try {
    const providerRequest = boardOutputLimit === undefined
      ? request
      : { ...request, max_tokens: boardOutputLimit, max_completion_tokens: undefined };
    const response = await client.chat.completions.create(providerRequest, { maxRetries: 0 });
    const input = response.usage?.prompt_tokens;
    const output = response.usage?.completion_tokens;
    const knownInput = typeof input === "number" && Number.isSafeInteger(input) && input >= 0 ? input : undefined;
    const knownOutput = typeof output === "number" && Number.isSafeInteger(output) && output >= 0 ? output : undefined;
    scope.inputTokens += knownInput ?? 0;
    scope.outputTokens += knownOutput ?? 0;
    scope.incomplete ||= knownInput === undefined || knownOutput === undefined;
    const { runs } = await creditCollections();
    await runs.updateOne({ _id: scope.jobId, status: "reserved" }, {
      $inc: { inputTokens: knownInput ?? 0, outputTokens: knownOutput ?? 0 },
      $set: { lastActivityAt: new Date() },
    });
    return response;
  } catch (error) {
    // A provider failure may be swallowed by a tool's fallback, but usage is unknown.
    scope.incomplete = true;
    throw error;
  }
}

type FinishedRun =
  | { failure: { status: string; error: { code: string; message: string }; completedAt: Date } }
  | { result: unknown; metadata: { model: string; durationMs: number }; usage: BoardUsage; replayData?: unknown };

export async function finishBoardRun(jobId: string, outcome: FinishedRun) {
  const { connection, runs, wallets } = await creditCollections();
  return connection.transaction(async (session) => {
    const run = await runs.findOne({ _id: jobId }, { session });
    if (!run) return false;
    if (run.status !== "reserved") return true;

    const finishedAt = new Date();
    if ("failure" in outcome) {
      await runs.updateOne({ _id: jobId }, {
        $set: { status: "refunded", charged: 0, finishedAt },
      }, { session });
      await AiJob.updateOne({ _id: jobId, status: "PROCESSING" }, { $set: outcome.failure }, { session });
      if (run.reserved) await wallets.updateOne(
        { _id: run.userId }, { $inc: { balance: run.reserved } }, { session },
      );
      return true;
    }

    const { inputTokens, outputTokens, incomplete } = outcome.usage;
    const actual = tokenCharge(inputTokens, outputTokens, run);
    const reason = incomplete ? "missing_provider_usage" : actual > run.reserved ? "usage_exceeds_reservation" : undefined;
    const charged = reason ? undefined : actual;
    await runs.updateOne({ _id: jobId }, { $set: {
      status: reason ? "needs_reconciliation" : "settled",
      inputTokens, outputTokens, charged, reason, finishedAt,
    } }, { session });
    if (charged !== undefined && run.reserved > charged) {
      await wallets.updateOne({ _id: run.userId }, { $inc: { balance: run.reserved - charged } }, { session });
    }
    await AiJob.updateOne({ _id: jobId, status: "PROCESSING" }, { $set: {
      status: "COMPLETED",
      ...(outcome.replayData === undefined ? {} : { replayData: outcome.replayData }),
      result: outcome.result,
      model: { name: outcome.metadata.model },
      metrics: {
        processingTime: outcome.metadata.durationMs,
        inputTokens: incomplete ? undefined : inputTokens,
        outputTokens: incomplete ? undefined : outputTokens,
        creditsUsed: charged,
      },
      completedAt: finishedAt,
    } }, { session });
    return true;
  });
}

// Wallet reads and the server sweep both finalize holds here,
// even if a provider response or another recovery arrives concurrently.
export async function recoverBoardRuns(userId?: string) {
  const cutoff = new Date(Date.now() - BOARD_HOLD_TIMEOUT_MS);
  const stale = {
    ...(userId ? { userId } : {}),
    $or: [
      { status: "reserved" as const, lastActivityAt: { $lte: cutoff } },
      { status: "reserved" as const, lastActivityAt: { $exists: false }, createdAt: { $lte: cutoff } },
      { status: "needs_reconciliation" as const, finishedAt: { $lte: cutoff } },
      { status: "needs_reconciliation" as const, finishedAt: { $exists: false }, createdAt: { $lte: cutoff } },
    ],
  };
  const { connection, runs, wallets } = await creditCollections();
  for (const { _id } of await runs.find(stale, { projection: { _id: 1 }, limit: 50 }).toArray()) {
    await connection.transaction(async (session) => {
      const run = await runs.findOne({ _id, ...stale }, { session });
      if (!run) return;
      const knownCharge = tokenCharge(run.inputTokens ?? 0, run.outputTokens ?? 0, run);
      const charged = Math.min(knownCharge, run.reserved);
      const finishedAt = new Date();
      await runs.updateOne({ _id }, { $set: {
        status: charged ? "settled" : "refunded",
        charged,
        reason: knownCharge > run.reserved ? "recovered_usage_capped_at_hold"
          : charged ? "recovered_confirmed_usage" : "recovered_unknown_usage",
        finishedAt,
      } }, { session });
      if (run.reserved > charged) {
        await wallets.updateOne({ _id: run.userId }, {
          $inc: { balance: run.reserved - charged },
        }, { session });
      }
      await AiJob.updateOne({ _id, status: "PROCESSING" }, { $set: {
        status: "FAILED",
        error: { code: "BOARD_RUN_EXPIRED", message: "The Board run expired." },
        completedAt: finishedAt,
      } }, { session });
      await AiJob.updateOne({ _id }, { $set: { "metrics.creditsUsed": charged } }, { session });
    });
  }
}
