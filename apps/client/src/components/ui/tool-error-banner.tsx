"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, RotateCcw, Copy, Check, X } from "lucide-react";
import type { NormalizedClientError } from "@/lib/api.dto";

interface ToolErrorBannerProps {
  error: NormalizedClientError | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  isLoading?: boolean;
}

export function ToolErrorBanner({
  error,
  onRetry,
  onDismiss,
  isLoading = false,
}: ToolErrorBannerProps) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  const errorObj: NormalizedClientError | null =
    typeof error === "string"
      ? { code: "ERROR", message: error, retryable: true }
      : error;

  useEffect(() => {
    if (errorObj?.retryAfter && errorObj.retryAfter > 0) {
      setCountdown(errorObj.retryAfter);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCountdown(0);
    }
  }, [errorObj?.retryAfter]);

  if (!errorObj) return null;

  const handleCopyRequestId = async () => {
    if (errorObj.requestId) {
      try {
        await navigator.clipboard.writeText(errorObj.requestId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard access rejection
      }
    }
  };

  const isRetryDisabled = isLoading || countdown > 0;

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-950 dark:text-amber-200 text-xs my-3 transition-all animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold sm:font-medium text-amber-950 dark:text-amber-100">{errorObj.message}</p>
          {errorObj.requestId && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800/80 dark:text-amber-400/80">
              <span>Reference ID:</span>
              <button
                type="button"
                onClick={handleCopyRequestId}
                className="font-mono underline hover:text-amber-950 dark:hover:text-amber-200 flex items-center gap-1 font-semibold dark:font-normal"
                title="Click to copy support reference"
              >
                {errorObj.requestId}
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 opacity-70" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {errorObj.retryable && onRetry && (
          <button
            type="button"
            disabled={isRetryDisabled}
            onClick={onRetry}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold sm:font-medium transition-all ${
              isRetryDisabled
                ? "bg-amber-100/60 dark:bg-amber-500/5 text-amber-400 dark:text-amber-400/50 cursor-not-allowed border border-amber-200 dark:border-amber-500/10"
                : "bg-amber-200/70 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 border border-amber-400/60 dark:border-amber-500/30 active:scale-95 shadow-2xs"
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {countdown > 0 ? `Wait ${countdown}s` : "Try Again"}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-amber-700 hover:text-amber-950 hover:bg-amber-200/50 dark:text-amber-400/60 dark:hover:text-amber-200 dark:hover:bg-amber-500/10 transition-colors"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
