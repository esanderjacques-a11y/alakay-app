/**
 * Redirect target for Supabase confirmation / recovery emails.
 * Prefer NEXT_PUBLIC_SITE_URL (stable Vercel production URL) so emails
 * never point at ephemeral preview deployments or localhost when configured.
 */
export function getAuthEmailRedirectTo() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      /* fall through */
    }
  }

  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

/** Strip auth tokens from the URL after the client has consumed them. */
export function clearAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = url.searchParams;

  const sensitive = [
    "access_token",
    "refresh_token",
    "expires_in",
    "expires_at",
    "token_type",
    "type",
    "code",
    "error",
    "error_code",
    "error_description",
  ];

  let changed = false;
  for (const key of sensitive) {
    if (hashParams.has(key)) {
      hashParams.delete(key);
      changed = true;
    }
    if (searchParams.has(key)) {
      searchParams.delete(key);
      changed = true;
    }
  }

  if (!changed) return;

  const nextHash = hashParams.toString();
  const next = `${url.pathname}${searchParams.toString() ? `?${searchParams}` : ""}${
    nextHash ? `#${nextHash}` : ""
  }`;
  window.history.replaceState(window.history.state, "", next || url.pathname);
}

export function authUrlLooksLikeSignupConfirm() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const fromHash = new URLSearchParams(hash).get("type");
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  const type = (fromHash || fromQuery || "").toLowerCase();
  return type === "signup" || type === "email" || type === "invite";
}

export const PENDING_EMAIL_CONFIRM_KEY = "cultosol-pending-email-confirm";
export const JUST_VERIFIED_KEY = "cultosol-just-verified";

export function markPendingEmailConfirm(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_CONFIRM_KEY, email);
  } catch {
    /* private mode */
  }
}

export function clearPendingEmailConfirm() {
  try {
    sessionStorage.removeItem(PENDING_EMAIL_CONFIRM_KEY);
  } catch {
    /* ignore */
  }
}

export function consumeJustVerifiedFlag() {
  try {
    const pending = sessionStorage.getItem(PENDING_EMAIL_CONFIRM_KEY);
    const fromUrl = authUrlLooksLikeSignupConfirm();
    if (pending || fromUrl) {
      sessionStorage.setItem(JUST_VERIFIED_KEY, "1");
      sessionStorage.removeItem(PENDING_EMAIL_CONFIRM_KEY);
    }
    const justVerified = sessionStorage.getItem(JUST_VERIFIED_KEY) === "1";
    if (justVerified) {
      sessionStorage.removeItem(JUST_VERIFIED_KEY);
    }
    return justVerified;
  } catch {
    return false;
  }
}
