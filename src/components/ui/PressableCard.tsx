"use client";

import { Fragment, type ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "normal";
  badge?: string;
};

export default function PressableCard({
  icon,
  title,
  text,
  onClick,
  disabled,
  tone = "normal",
  badge,
}: Props) {
  const cardClass = `h-full w-full rounded-3xl p-6 text-left transition duration-200 ${
    tone === "primary"
      ? "bg-green-700/95 text-white shadow-lg shadow-green-900/15"
      : "glass-panel text-slate-900"
  } ${
    disabled
      ? "cursor-not-allowed opacity-50"
      : "active:scale-[0.98] md:hover:-translate-y-0.5 md:hover:shadow-lg"
  }`;

  const body = (
    <Fragment>
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          tone === "primary"
            ? "bg-white/15 text-white"
            : "bg-green-100/90 text-green-800"
        }`}
      >
        {icon}
      </span>

      <span className="mt-5 flex items-center gap-2">
        <h3
          className={`text-lg font-extrabold ${
            tone === "primary" ? "text-white" : "text-green-900"
          }`}
        >
          {title}
        </h3>
        {badge ? (
          <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-slate-500">
            {badge}
          </span>
        ) : null}
      </span>

      <p
        className={`mt-2 text-sm ${
          tone === "primary" ? "text-green-50" : "text-slate-600"
        }`}
      >
        {text}
      </p>
    </Fragment>
  );

  if (!onClick || disabled) {
    return <section className={cardClass}>{body}</section>;
  }

  return (
    <button type="button" onClick={onClick} className={`touch-target ${cardClass}`}>
      {body}
    </button>
  );
}
