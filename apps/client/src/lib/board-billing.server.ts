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

export function estimateBoardRun(type: string, text: string, rates: Rates) {
  const bytes = Buffer.byteLength(text);
  switch (type) {
    case "AI_DETECTOR":
      return 0;
    case "AI_HUMANIZER":
      return tokenCharge(2 * bytes + 12_000, 1_500 + env.BOARD_DEFAULT_MAX_OUTPUT_TOKENS, rates);
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

export async function createTrackedCompletion(client: OpenAI, request: ChatCompletionCreateParamsNonStreaming) {
  const scope = invocationScope.getStore();
  if (!scope) return client.chat.completions.create(request);
  if (scope.blocked) throw scope.blocked;

  scope.estimatedInput += Buffer.byteLength(JSON.stringify(request.messages)) + 512;
  scope.estimatedOutput += request.max_completion_tokens ?? request.max_tokens ?? env.BOARD_DEFAULT_MAX_OUTPUT_TOKENS;

  try {
    const { connection, runs, wallets } = await creditCollections();
    await connection.transaction(async (session) => {
      const run = await runs.findOne({ _id: scope.jobId, status: "reserved" }, { session });
      if (!run) throw new Error("Board credit reservation is missing.");
      const required = tokenCharge(scope.estimatedInput, scope.estimatedOutput, run);
      const additional = required - run.reserved;
      if (additional <= 0) return;
      const debit = await wallets.updateOne(
        { _id: run.userId, balance: { $gte: additional } },
        { $inc: { balance: -additional } },
        { session },
      );
      if (!debit.modifiedCount) throw new CreditRequiredError(402);
      await runs.updateOne({ _id: scope.jobId }, { $inc: { reserved: additional } }, { session });
    });
  } catch (error) {
    scope.blocked = error;
    throw error;
  }

  try {
    const response = await client.chat.completions.create(request);
    const input = response.usage?.prompt_tokens;
    const output = response.usage?.completion_tokens;
    if (typeof input === "number" && Number.isSafeInteger(input) && input >= 0) scope.inputTokens += input;
    else scope.incomplete = true;
    if (typeof output === "number" && Number.isSafeInteger(output) && output >= 0) scope.outputTokens += output;
    else scope.incomplete = true;
    return response;
  } catch (error) {
    // A provider failure may be swallowed by a tool's fallback, but usage is unknown.
    scope.incomplete = true;
    throw error;
  }
}

type FinishedRun =
  | { failure: { status: string; error: { code: string; message: string }; completedAt: Date } }
  | { result: unknown; metadata: { model: string; durationMs: number }; usage: BoardUsage };

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
