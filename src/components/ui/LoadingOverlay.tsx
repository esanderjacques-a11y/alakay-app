"use client";

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
      <article className="app-loading-pill pointer-events-auto flex min-w-0 max-w-[min(88vw,18rem)] items-center gap-2 rounded-full px-3 py-2 text-center">
        <span className="app-loading-mark" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <p className="min-w-0 truncate text-xs font-bold sm:text-sm">{label}</p>
      </article>
    </section>
  );
}
