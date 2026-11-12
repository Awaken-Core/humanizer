import DodoPayments from "dodopayments";
import { client } from "./db";
import { env } from "./env";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  PRO_PUBLIC_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.schema";

export async function publicHumanizerLimit(userId?: string) {
  if (userId) {
    const { purchases } = await creditCollections();
    const verified = await purchases.findOne(
      { userId, paymentId: { $type: "string", $ne: "" } },
      { projection: { _id: 1 } },
    );
    if (verified) return PRO_PUBLIC_MAX_INPUT_TEXT_LENGTH;
  }
  return ANONYMOUS_MAX_INPUT_TEXT_LENGTH;
}

export function creditPack() {
  const productId = env.DODO_PAYMENTS_PRODUCT_ID;
  const credits = env.DODO_PAYMENTS_PACK_CREDITS;
  if (!productId || !credits || !env.DODO_PAYMENTS_API_KEY || !env.DODO_PAYMENTS_WEBHOOK_KEY) return null;
  return { productId, credits };
}

export function dodoClient() {
  return new DodoPayments({
    environment: env.DODO_PAYMENTS_ENVIRONMENT,
    bearerToken: env.DODO_PAYMENTS_API_KEY,
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
  });
}

export async function creditCollections() {
  const { connection } = await client();
  const db = connection.db;
  if (!db) throw new Error("Credits database unavailable");
  return {
    connection,
    wallets: db.collection<{ _id: string; balance: number }>("credit_wallets"),
    purchases: db.collection<{
      _id: string;
      userId: string;
      productId: string;
      credits: number;
      paymentId?: string;
      checkoutSessionId?: string;
    }>("credit_purchases"),
    runs: db.collection<{
      _id: string;
      userId: string;
      requestFingerprint?: string;
      status: "reserved" | "settled" | "refunded" | "needs_reconciliation";
      reserved: number;
      inputRate: number;
      outputRate: number;
      inputTokens?: number;
      outputTokens?: number;
      charged?: number;
      reason?: string;
      createdAt: Date;
      lastActivityAt?: Date;
      finishedAt?: Date;
    }>("credit_runs"),
    receipts: db.collection<{ _id: string; purchaseId: string }>("credit_payment_receipts"),
  };
}

export class CreditRequiredError extends Error {
  constructor(readonly status: 401 | 402) {
    super(status === 401 ? "Sign in to use credits." : "You’re out of credits. Buy more from the pricing section.");
  }
}

type DodoPayment = Awaited<ReturnType<ReturnType<typeof dodoClient>["payments"]["retrieve"]>>;

export async function grantPurchaseCredits(purchaseId: string, payment: DodoPayment) {
  if (payment.status !== "succeeded" || payment.metadata?.humanizer_credit_purchase_id !== purchaseId) {
    throw new Error("Payment is unconfirmed or does not match the credit purchase.");
  }
  const { connection, purchases, wallets, receipts } = await creditCollections();
  await connection.transaction(async (session) => {
    const purchase = await purchases.findOne({ _id: purchaseId }, { session });
    if (!purchase || purchase.paymentId) return;

    const cart = payment.product_cart;
    if (payment.is_update_payment_method || payment.is_multi_subscription || payment.subscription_id || cart?.length !== 1 ||
        cart[0].product_id !== purchase.productId || cart[0].quantity !== 1) {
      throw new Error("Payment does not match the credit purchase.");
    }

    if (await receipts.findOne({ _id: payment.payment_id }, { session })) return;
    await receipts.insertOne({ _id: payment.payment_id, purchaseId }, { session });
    await purchases.updateOne({ _id: purchaseId }, { $set: { paymentId: payment.payment_id } }, { session });
    await wallets.updateOne({ _id: purchase.userId }, { $inc: { balance: purchase.credits } }, { session, upsert: true });
  });
}
