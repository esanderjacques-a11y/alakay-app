export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CountryRow = { country: string | null; province_state: string | null };
type LanguageRow = { language: string | null };

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({
      configured: false,
      totalAnalyses: 0,
      totalCountries: 0,
      countries: [],
      regions: [],
      languages: [],
      featured: null,
    });
  }

  const { data: analyses, error: analysesError } = await admin
    .from("analyses")
    .select("country, province_state")
    .eq("is_deleted", false)
    .not("country", "is", null);

  if (analysesError) {
    console.error("Impact analyses error:", analysesError);
  }

  const rows = (analyses || []) as CountryRow[];
  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();

  for (const row of rows) {
    const country = row.country?.trim();
    if (!country) continue;
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    const region = row.province_state?.trim();
    if (region) {
      const key = `${country} · ${region}`;
      regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
    }
  }

  const countries = [...countryCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const regions = [...regionCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const { data: feedbackRows, error: feedbackError } = await admin
    .from("app_feedback")
    .select("id, name, country, message, rating, created_at")
    .eq("is_approved", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (feedbackError) {
    console.error("Impact featured feedback error:", feedbackError);
  }

  const { data: languageRows, error: languageError } = await admin
    .from("app_feedback")
    .select("language")
    .not("language", "is", null);

  if (languageError) {
    console.error("Impact language feedback error:", languageError);
  }

  const languageCounts = new Map<string, number>();
  for (const row of (languageRows || []) as LanguageRow[]) {
    const lang = row.language?.trim();
    if (!lang) continue;
    languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
  }

  const languages = [...languageCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({
    configured: true,
    totalAnalyses: rows.length,
    totalCountries: countryCounts.size,
    countries,
    regions,
    languages,
    featured: feedbackRows?.[0] || null,
  });
}
