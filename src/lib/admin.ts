const DEFAULT_ADMIN_EMAILS = [
  "jesander@earth.ac.cr",
  "esanderjacques@gmail.com",
];

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.trim();
  if (!fromEnv) return DEFAULT_ADMIN_EMAILS;
  return fromEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}
