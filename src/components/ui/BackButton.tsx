"use client";

import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  onClick: () => void;
  label: string;
  variant?: "icon" | "labeled";
  className?: string;
};

export default function BackButton({
  onClick,
  label,
  variant = "labeled",
  className = "",
}: BackButtonProps) {
  const base = "page-back-btn touch-target active:scale-[0.98]";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${base} inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${className}`.trim()}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} inline-flex min-h-9 shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${className}`.trim()}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
