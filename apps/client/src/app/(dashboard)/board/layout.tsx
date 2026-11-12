import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { creditCollections, creditPack } from "@/lib/credits.server";
import { BoardPaywall } from "@/components/board-paywall";

export default async function BoardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const session = await (await getAuth()).api.getSession({ headers: requestHeaders });
  if (session) {
    const { wallets } = await creditCollections();
    const wallet = await wallets.findOne({ _id: session.user.id });
    if ((wallet?.balance ?? 0) > 0) return children;
  }

  return <BoardPaywall signedIn={Boolean(session)} packCredits={creditPack()?.credits} />;
}
