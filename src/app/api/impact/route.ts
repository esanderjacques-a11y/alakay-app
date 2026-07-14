export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type AnalysisRow = {
  country: string | null;
  province_state: string | null;
  sample_type_id: number | null;
  crop_id: number | null;
  created_at: string | null;
};

type LanguageRow = { language: string | null };
type RatingRow = { rating: number | null };
type CropRow = { crop_id: number; crop_name: string | null };

function countMapEntries(map: Map<string, number>, limit?: number) {
  const entries = [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  return typeof limit === "number" ? entries.slice(0, limit) : entries;
}

function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json({
      configured: false,
      totalAnalyses: 0,
      totalCountries: 0,
      totalFeedback: 0,
      averageRating: null,
      soilShare: 0,
      foliarShare: 0,
      countries: [],
      regions: [],
      languages: [],
      crops: [],
      months: [],
      sampleTypes: [],
      featured: null,
    });
  }

  const { data: analyses, error: analysesError } = await admin
    .from("analyses")
    .select("country, province_state, sample_type_id, crop_id, created_at")
    .eq("is_deleted", false);

  if (analysesError) {
    console.error("Impact analyses error:", analysesError);
  }

  const rows = (analyses || []) as AnalysisRow[];
  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const cropCounts = new Map<number, number>();
  const monthCounts = new Map<string, number>();
  let soilCount = 0;
  let foliarCount = 0;
  let withCountry = 0;

  for (const row of rows) {
    if (row.sample_type_id === 2) foliarCount += 1;
    else soilCount += 1;

    if (row.crop_id != null && row.crop_id !== 999) {
      cropCounts.set(row.crop_id, (cropCounts.get(row.crop_id) || 0) + 1);
    }

    if (row.created_at) {
      const key = monthKey(row.created_at);
      if (key) monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }

    const country = row.country?.trim();
    if (!country) continue;
    withCountry += 1;
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    const region = row.province_state?.trim();
    if (region) {
      const key = `${country} · ${region}`;
      regionCounts.set(key, (regionCounts.get(key) || 0) + 1);
    }
  }

  const countries = countMapEntries(countryCounts, 12);
  const regions = countMapEntries(regionCounts, 8);

  const topCropIds = [...cropCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  let cropNameById = new Map<number, string>();
  if (topCropIds.length > 0) {
    const { data: cropRows, error: cropError } = await admin
      .from("crops")
      .select("crop_id, crop_name")
      .in("crop_id", topCropIds);
    if (cropError) console.error("Impact crops error:", cropError);
    cropNameById = new Map(
      ((cropRows || []) as CropRow[]).map((c) => [c.crop_id, c.crop_name || `Crop ${c.crop_id}`])
    );
  }

  const crops = topCropIds.map((id) => ({
    name: cropNameById.get(id) || `Crop ${id}`,
    count: cropCounts.get(id) || 0,
  }));

  const monthKeys = lastNMonths(6);
  const months = monthKeys.map((key) => ({
    name: key,
    count: monthCounts.get(key) || 0,
  }));

  const typedTotal = soilCount + foliarCount;
  const sampleTypes = [
    { name: "soil", count: soilCount },
    { name: "foliar", count: foliarCount },
  ];

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

  const { data: ratingRows, error: ratingError } = await admin
    .from("app_feedback")
    .select("rating")
    .eq("is_approved", true)
    .not("rating", "is", null);

  if (ratingError) {
    console.error("Impact rating feedback error:", ratingError);
  }

  const ratings = ((ratingRows || []) as RatingRow[])
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r > 0);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10
      : null;

  const { count: feedbackCount } = await admin
    .from("app_feedback")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", true);

  return Response.json({
    configured: true,
    totalAnalyses: rows.length,
    totalCountries: countryCounts.size,
    totalFeedback: feedbackCount || 0,
    averageRating,
    soilShare: typedTotal > 0 ? Math.round((soilCount / typedTotal) * 100) : 0,
    foliarShare: typedTotal > 0 ? Math.round((foliarCount / typedTotal) * 100) : 0,
    countries,
    regions,
    languages: countMapEntries(languageCounts),
    crops,
    months,
    sampleTypes,
    featured: feedbackRows?.[0] || null,
    withCountry,
  });
}
