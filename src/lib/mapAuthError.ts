import type { AuthError } from "@supabase/supabase-js";

export type AuthErrorKind =
  | "email_not_confirmed"
  | "already_registered"
  | "invalid_credentials"
  | "rate_limited"
  | "smtp_failed"
  | "generic";

type AuthErrorLabels = {
  emailNotConfirmed: string;
  emailAlreadyRegistered: string;
  incorrectLogin: string;
  rateLimited: string;
  smtpFailed: string;
};

function readCode(error: AuthError | { message?: string; code?: string; status?: number }) {
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = (error.message || "").toLowerCase();
  const status = "status" in error && typeof error.status === "number" ? error.status : 0;
  return { code: code.toLowerCase(), message, status };
}

export function classifyAuthError(
  error: AuthError | { message?: string; code?: string; status?: number } | null | undefined
): AuthErrorKind {
  if (!error) return "generic";
  const { code, message, status } = readCode(error);

  if (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed") ||
    message.includes("confirm your email")
  ) {
    return "email_not_confirmed";
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists") ||
    message.includes("email address is already")
  ) {
    return "already_registered";
  }

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("for security purposes")
  ) {
    return "rate_limited";
  }

  if (
    code === "unexpected_failure" ||
    message.includes("error sending confirmation email") ||
    message.includes("error sending recovery email") ||
    message.includes("error sending magic link") ||
    message.includes("unauthorized ip") ||
    message.includes("smtp")
  ) {
    return "smtp_failed";
  }

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login") ||
    message.includes("invalid credentials")
  ) {
    return "invalid_credentials";
  }

  return "generic";
}

export function mapAuthError(
  error: AuthError | { message?: string; code?: string; status?: number } | null | undefined,
  labels: AuthErrorLabels
): string {
  const kind = classifyAuthError(error);
  switch (kind) {
    case "email_not_confirmed":
      return labels.emailNotConfirmed;
    case "already_registered":
      return labels.emailAlreadyRegistered;
    case "invalid_credentials":
      return labels.incorrectLogin;
    case "rate_limited":
      return labels.rateLimited;
    case "smtp_failed":
      return labels.smtpFailed;
    default:
      return error?.message?.trim() || labels.incorrectLogin;
  }
}
