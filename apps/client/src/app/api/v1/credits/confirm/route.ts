import { getAuth } from "@/lib/auth";
import { creditCollections, dodoClient, grantPurchaseCredits } from "@/lib/credits.server";

export async function POST(request: Request) {
  const auth = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!auth) return Response.json({ status: "signed_out" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.purchaseId !== "string") {
    return Response.json({ status: "invalid" }, { status: 400 });
  }

  try {
    const { purchases } = await creditCollections();
    const purchase = await purchases.findOne({ _id: body.purchaseId, userId: auth.user.id });
    if (!purchase) return Response.json({ status: "invalid" }, { status: 404 });
    if (purchase.paymentId) return Response.json({ status: "confirmed" });
    if (!purchase.checkoutSessionId) return Response.json({ status: "pending" });

    const dodo = dodoClient();
    const checkout = await dodo.checkoutSessions.retrieve(purchase.checkoutSessionId);
    if (!checkout.payment_id) return Response.json({ status: "pending" });
    const payment = await dodo.payments.retrieve(checkout.payment_id);
    if (payment.status === "failed" || payment.status === "cancelled") {
      return Response.json({ status: "failed" });
    }
    if (payment.status !== "succeeded") return Response.json({ status: "pending" });

    await grantPurchaseCredits(purchase._id, payment);
    return Response.json({ status: "confirmed" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
