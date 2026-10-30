"use client";

import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumanizeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  label?: string;
}

/**
 * Premium Humanize Action Button
 * Engineered with high-contrast electric-blue/cyan styling, subtle elevation,
 * smooth hover/active transitions, directional arrow icon, and clear loading/disabled feedback.
 */
export const HumanizeButton: React.FC<HumanizeButtonProps> = ({
  isLoading = false,
  label = "Humanize text",
  disabled,
  className,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(
        // Base structure & typography
        "group relative inline-flex items-center justify-center gap-2.5 px-6 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 select-none",
        // Proportions & shape (rounded SaaS action, not pill-like)
        "rounded-xl border",
        // Visual styling: Solid electric-blue / cyan treatment with crisp contrast
        !isDisabled && [
          "bg-gradient-to-r from-[#0066FF] via-[#0070F3] to-[#0099FF] text-white",
          "border-[#0080FF]/40 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_0_20px_rgba(0,112,243,0.25)]",
          "hover:border-[#00B4D8]/60 hover:shadow-[0_2px_4px_rgba(0,0,0,0.5),0_0_28px_rgba(0,150,255,0.45)] hover:brightness-105",
          "active:scale-[0.985] active:brightness-95",
        ],
        // Disabled / Loading styling
        isDisabled && [
          "bg-[#1A1D24] text-[#6B7280] border-[#2A2F3D] cursor-not-allowed shadow-none",
        ],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white/90" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
};

