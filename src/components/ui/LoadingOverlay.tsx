"use client";

import { LoaderCircle } from "lucide-react";

type Props = {
  open: boolean;
  label: string;
};

export default function LoadingOverlay({ open, label }: Props) {
  if (!open) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-[max(0.9rem,env(safe-area-inset-top))] z-[20000] flex justify-center px-4 animate-fade-in"
    >
      <article className="pointer-events-auto flex min-w-0 max-w-[min(88vw,18rem)] items-center gap-2 rounded-full border border-white/70 bg-white/78 px-3 py-2 text-center shadow-xl shadow-green-950/12 backdrop-blur-2xl">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-600/12 text-green-800 ring-1 ring-green-700/15" aria-hidden>
          <LoaderCircle size={17} strokeWidth={2.5} className="loading-spin" />
        </span>
        <p className="min-w-0 truncate text-xs font-extrabold text-green-950 sm:text-sm">{label}</p>
      </article>
    </section>
  );
}
