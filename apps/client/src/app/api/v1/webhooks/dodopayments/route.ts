import { dodoClient, grantPurchaseCredits } from "@/lib/credits.server";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  if (!env.DODO_PAYMENTS_WEBHOOK_KEY || !env.DODO_PAYMENTS_API_KEY) {
    return Response.json({ error: "Webhook unavailable." }, { status: 503 });
  }

  let event: ReturnType<ReturnType<typeof dodoClient>["webhooks"]["unwrap"]>;
  try {
    event = dodoClient().webhooks.unwrap(await request.text(), {
      headers: {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      },
    });
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  if (event.type !== "payment.succeeded") return Response.json({ received: true });
  const payment = event.data;
  const purchaseId = payment.metadata?.humanizer_credit_purchase_id;
  if (typeof purchaseId !== "string" || !purchaseId) return Response.json({ received: true });

  try {
    await grantPurchaseCredits(purchaseId, payment);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Could not process the payment." }, { status: 500 });
  }
}
