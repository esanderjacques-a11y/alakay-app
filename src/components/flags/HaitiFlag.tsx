import type { SVGProps } from "react";

/** Haiti — blue upper, red lower, white panel with coat of arms (3:2). */
export default function HaitiFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 3 2" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="3" height="1" fill="#00209F" />
      <rect y="1" width="3" height="1" fill="#D21034" />
      <rect x="1.05" y="0.32" width="0.9" height="1.36" fill="#FFFFFF" />
      <circle cx="1.5" cy="1" r="0.26" fill="#00209F" />
      <circle cx="1.5" cy="1" r="0.13" fill="#D21034" />
      <rect x="1.44" y="0.62" width="0.12" height="0.76" fill="#F1B517" />
      <rect x="1.22" y="0.88" width="0.56" height="0.12" fill="#016A16" />
      <path fill="#016A16" d="M1.28 1.18 L1.5 1.02 L1.72 1.18 L1.5 1.34 Z" />
    </svg>
  );
}
