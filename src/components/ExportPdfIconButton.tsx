"use client";

import { FileText } from "lucide-react";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  className?: string;
};

export default function ExportPdfIconButton({
  onClick,
  disabled,
  busy,
  label,
  className = "",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      className={`glass-icon-btn export-pdf-icon-btn shrink-0 rounded-xl p-2 ${className}`}
    >
      {busy ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden
        />
      ) : (
        <FileText size={17} strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}
