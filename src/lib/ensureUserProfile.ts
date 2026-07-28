import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Language } from "@/lib/translations";

function readMetaString(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readMetaBool(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function buildFullName(meta: Record<string, unknown>) {
  const first = readMetaString(meta, "first_name");
  const middle = readMetaString(meta, "middle_name");
  const last = readMetaString(meta, "last_name");
  const fromParts = [first, middle, last].filter(Boolean).join(" ").trim();
  if (fromParts) return fromParts;
  return readMetaString(meta, "full_name");
}

/**
 * Creates or updates profiles + user_settings from auth user_metadata.
 * Safe to call on every SIGNED_IN; uses upsert / ignore-duplicate patterns.
 */
export async function ensureUserProfile(
  user: User,
  language: Language
): Promise<{ error: string | null }> {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  const firstName = readMetaString(meta, "first_name");
  const lastName = readMetaString(meta, "last_name");
  const middleName = readMetaString(meta, "middle_name") || null;
  const profession = readMetaString(meta, "profession") || null;
  const country = readMetaString(meta, "country") || null;
  const provinceState = readMetaString(meta, "province_state") || null;
  const locationSource = readMetaString(meta, "location_source") || "manual";
  const acceptsPolicies = readMetaBool(meta, "accepts_policies");
  const acceptsEmails = readMetaBool(meta, "accepts_emails");
  const fullName = buildFullName(meta) || user.email || "";

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    full_name: fullName,
    first_name: firstName || null,
    last_name: lastName || null,
    middle_name: middleName,
    profession,
    country,
    province_state: provinceState,
    location_source: locationSource,
    accepts_policies: acceptsPolicies,
    accepts_emails: acceptsEmails,
    preferred_language: language,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  const { data: existingSettings } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingSettings) {
    const { error: settingsError } = await supabase.from("user_settings").insert({
      user_id: user.id,
      language,
      theme: "light",
    });

    if (settingsError && !/duplicate|unique|already exists/i.test(settingsError.message)) {
      return { error: settingsError.message };
    }
  }

  return { error: null };
}
