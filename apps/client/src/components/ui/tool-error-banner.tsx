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

  const handleCopyRequestId = () => {
    if (errorObj.requestId) {
      navigator.clipboard.writeText(errorObj.requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isRetryDisabled = isLoading || countdown > 0;

  return (
    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs my-3 transition-all animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-medium text-amber-100">{errorObj.message}</p>
          {errorObj.requestId && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
              <span>Reference ID:</span>
              <button
                type="button"
                onClick={handleCopyRequestId}
                className="font-mono underline hover:text-amber-200 flex items-center gap-1"
                title="Click to copy support reference"
              >
                {errorObj.requestId}
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 opacity-60" />
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isRetryDisabled
                ? "bg-amber-500/5 text-amber-400/50 cursor-not-allowed border border-amber-500/10"
                : "bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/30 active:scale-95"
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
            className="p-1 rounded-md text-amber-400/60 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

