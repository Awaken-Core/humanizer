import { getAuth } from "@/lib/auth";
import { creditCollections, creditPack, dodoClient, publicHumanizerLimit } from "@/lib/credits.server";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const pack = creditPack();
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  const publicLimit = await publicHumanizerLimit(session?.user.id);
  const headers = { "Cache-Control": "private, no-store" };
  if (!pack) return Response.json({ enabled: false, publicHumanizerLimit: publicLimit }, { headers });
  const wallet = session && await (await creditCollections()).wallets.findOne({ _id: session.user.id });
  return Response.json({
    enabled: true,
    packCredits: pack.credits,
    publicHumanizerLimit: publicLimit,
    signedIn: Boolean(session),
    balance: wallet?.balance ?? 0,
  }, { headers });
}

export async function POST(request: Request) {
  const appUrl = new URL(env.NEXT_PUBLIC_APP_BASE_URL);
  if (request.headers.get("origin") !== appUrl.origin) {
    return Response.json({ error: "Invalid checkout origin." }, { status: 403 });
  }
  const pack = creditPack();
  if (!pack) return Response.json({ error: "Credit purchases are unavailable." }, { status: 503 });

  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to buy credits." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fromBoard = body?.source === "board";
  const cancelPath = fromBoard ? "/board" : "/#pricing";

  try {
    const { purchases } = await creditCollections();
    const purchaseId = crypto.randomUUID();
    const returnPath = fromBoard ? `/board?purchase=${purchaseId}` : "/?credits=returned#pricing";
    const dodo = dodoClient();
    const product = await dodo.products.retrieve(pack.productId);
    if (product.price.type !== "one_time_price" || product.price.price <= 0) {
      throw new Error("Credit pack requires a priced one-time product.");
    }
    await purchases.insertOne({ _id: purchaseId, userId: session.user.id, ...pack });
    const checkout = await dodo.checkoutSessions.create({
      product_cart: [{
        product_id: pack.productId,
        quantity: 1,
        ...(product.price.pay_what_you_want ? { amount: product.price.price } : {}),
      }],
      feature_flags: { allow_discount_code: false },
      customer: { email: session.user.email, name: session.user.name },
      metadata: { humanizer_credit_purchase_id: purchaseId },
      return_url: new URL(returnPath, appUrl).href,
      cancel_url: new URL(cancelPath, appUrl).href,
    });
    if (!checkout.checkout_url) throw new Error("Missing hosted checkout URL");
    await purchases.updateOne({ _id: purchaseId }, { $set: { checkoutSessionId: checkout.session_id } });
    return Response.json({ checkoutUrl: checkout.checkout_url });
  } catch {
    return Response.json({ error: "Could not start checkout. Try again." }, { status: 502 });
  }
}
