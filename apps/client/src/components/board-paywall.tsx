"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { HeaderAuth } from "@/components/header-auth";
import { ArrowLeft, LayoutGrid } from "lucide-react";

export function BoardPaywall({ signedIn, packCredits }: { signedIn: boolean; packCredits?: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [confirmation, setConfirmation] = useState<"checking" | "waiting" | null>(null);

  useEffect(() => {
    const purchaseId = new URLSearchParams(window.location.search).get("purchase");
    if (!signedIn || !purchaseId) return;
    const controller = new AbortController();

    async function confirmPayment() {
      setConfirmation("checking");
      for (let attempt = 0; !controller.signal.aborted; attempt++) {
        try {
          const response = await fetch("/api/v1/credits/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purchaseId }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (controller.signal.aborted) return;
          if (result.status === "confirmed") {
            window.history.replaceState(null, "", "/board");
            router.refresh();
            return;
          }
          if (result.status === "failed" || result.status === "invalid") {
            setError("Payment could not be confirmed. You can try checkout again.");
            setConfirmation(null);
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        if (attempt === 14 && !controller.signal.aborted) setConfirmation("waiting");
        await new Promise((resolve) => setTimeout(resolve, attempt < 14 ? 2000 : 8000));
      }
      if (!controller.signal.aborted) setConfirmation("waiting");
    }

    void confirmPayment();
    return () => controller.abort();
  }, [router, signedIn]);

  async function buyCredits() {
    if (!signedIn) {
      window.dispatchEvent(new Event("country-rank:open-sign-in"));
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "board" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open checkout.");
      setPending(false);
    }
  }

  const primaryButton = "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60";

  return (
    <main className="min-h-dvh bg-background px-5 py-6 text-foreground sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <Link href="/ai-humanizer" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} aria-hidden="true" />
          AI Humanizer
        </Link>
        <HeaderAuth compact callbackURL="/board" />
      </header>

      <section aria-labelledby="board-title" className="mx-auto mt-14 w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:mt-24 sm:p-8">
        <div className="mb-5 inline-flex rounded-xl border border-border bg-muted p-3">
          <LayoutGrid size={22} aria-hidden="true" />
        </div>
        <h1 id="board-title" className="text-3xl font-semibold tracking-tight">Unlock Board</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Buy a credit pack with a one-time payment to use Board.
        </p>

        {confirmation ? (
          <p role="status" className="mt-6 rounded-lg border border-border bg-muted p-4 text-sm">
            {confirmation === "checking"
              ? "Confirming payment. Board will open automatically."
              : "Payment confirmation is taking longer than expected. Your credits will appear once confirmed."}
          </p>
        ) : packCredits ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-border p-4 text-sm font-semibold">
              {packCredits.toLocaleString()} credits per pack
            </div>
            <button type="button" className={primaryButton} disabled={pending} onClick={buyCredits}>
              {pending ? "Opening checkout..." : signedIn ? "Buy credits" : "Sign in to buy credits"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-lg border border-border bg-muted p-4 text-sm leading-6">
              Board checkout is currently unavailable. You can still use the free AI Humanizer.
            </p>
            <Link href="/ai-humanizer" className={primaryButton}>Open free AI Humanizer</Link>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p>}
        {signedIn && packCredits && confirmation !== "checking" && (
          <button type="button" className="mt-4 min-h-10 w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
            {refreshing ? "Checking balance..." : "Refresh credit balance"}
          </button>
        )}
      </section>
    </main>
  );
}
