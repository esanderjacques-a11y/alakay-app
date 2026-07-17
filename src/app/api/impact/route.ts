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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

function dayKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function hourKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${dayKey(iso)}T${pad2(date.getUTCHours())}`;
}

function lastNMonths(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`);
  }
  return keys;
}

function lastNDays(n: number) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    );
    keys.push(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
  }
  return keys;
}

function daysThisMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const keys: string[] = [];
  for (let day = 1; day <= today; day += 1) {
    keys.push(`${year}-${pad2(month + 1)}-${pad2(day)}`);
  }
  return keys;
}

function lastNHours(n: number) {
  const keys: string[] = [];
  const now = new Date();
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() - (n - 1)
  );
  for (let i = 0; i < n; i += 1) {
    const d = new Date(start + i * 60 * 60 * 1000);
    keys.push(
      `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}`
    );
  }
  return keys;
}

function seriesFromKeys(keys: string[], counts: Map<string, number>) {
  return keys.map((key) => ({
    name: key,
    count: counts.get(key) || 0,
  }));
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Response.json(
      {
        configured: false,
        totalAnalyses: 0,
        totalCountries: 0,
        totalRegions: 0,
        totalFeedback: 0,
        averageRating: null,
        soilShare: 0,
        foliarShare: 0,
        countries: [],
        regions: [],
        languages: [],
        crops: [],
        months: [],
        trends: {
          day: [],
          week: [],
          week1: [],
          month1: [],
          month3: [],
          month6: [],
          year: [],
        },
        sampleTypes: [],
        featured: null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  }

  const [
    analysesResult,
    featuredResult,
    languageResult,
    ratingResult,
    feedbackCountResult,
  ] = await Promise.all([
    admin
      .from("analyses")
      .select("country, province_state, sample_type_id, crop_id, created_at")
      .eq("is_deleted", false),
    admin
      .from("app_feedback")
      .select("id, name, country, message, rating, created_at")
      .eq("is_approved", true)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(1),
    admin.from("app_feedback").select("language").not("language", "is", null),
    admin
      .from("app_feedback")
      .select("rating")
      .eq("is_approved", true)
      .not("rating", "is", null),
    admin
      .from("app_feedback")
      .select("id", { count: "exact", head: true })
      .eq("is_approved", true),
  ]);

  const { data: analyses, error: analysesError } = analysesResult;
  if (analysesError) {
    console.error("Impact analyses error:", analysesError);
  }

  if (featuredResult.error) {
    console.error("Impact featured feedback error:", featuredResult.error);
  }
  if (languageResult.error) {
    console.error("Impact language feedback error:", languageResult.error);
  }
  if (ratingResult.error) {
    console.error("Impact rating feedback error:", ratingResult.error);
  }

  const feedbackRows = featuredResult.data;
  const languageRows = languageResult.data;
  const ratingRows = ratingResult.data;
  const feedbackCount = feedbackCountResult.count;

  const rows = (analyses || []) as AnalysisRow[];
  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const cropCounts = new Map<number, number>();
  const monthCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();
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
      const mKey = monthKey(row.created_at);
      if (mKey) monthCounts.set(mKey, (monthCounts.get(mKey) || 0) + 1);
      const dKey = dayKey(row.created_at);
      if (dKey) dayCounts.set(dKey, (dayCounts.get(dKey) || 0) + 1);
      const hKey = hourKey(row.created_at);
      if (hKey) hourCounts.set(hKey, (hourCounts.get(hKey) || 0) + 1);
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

  // Full country set for the choropleth; UI list still shows a top slice.
  const countries = countMapEntries(countryCounts);
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

  const trends = {
    day: seriesFromKeys(lastNHours(24), hourCounts),
    week: seriesFromKeys(lastNDays(7), dayCounts),
    week1: seriesFromKeys(lastNDays(7), dayCounts),
    month1: seriesFromKeys(daysThisMonth(), dayCounts),
    month3: seriesFromKeys(lastNMonths(3), monthCounts),
    month6: seriesFromKeys(lastNMonths(6), monthCounts),
    year: seriesFromKeys(lastNMonths(12), monthCounts),
    // Legacy alias
    month: seriesFromKeys(daysThisMonth(), dayCounts),
  };
  // Keep months for older clients; same as year view.
  const months = trends.year;

  const typedTotal = soilCount + foliarCount;
  const sampleTypes = [
    { name: "soil", count: soilCount },
    { name: "foliar", count: foliarCount },
  ];

  const languageCounts = new Map<string, number>();
  for (const row of (languageRows || []) as LanguageRow[]) {
    const lang = row.language?.trim();
    if (!lang) continue;
    languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
  }

  const ratings = ((ratingRows || []) as RatingRow[])
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === "number" && r > 0);
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, n) => sum + n, 0) / ratings.length) * 10) / 10
      : null;

  return Response.json(
    {
      configured: true,
      totalAnalyses: rows.length,
      totalCountries: countryCounts.size,
      totalRegions: regionCounts.size,
      totalFeedback: feedbackCount || 0,
      averageRating,
      soilShare: typedTotal > 0 ? Math.round((soilCount / typedTotal) * 100) : 0,
      foliarShare: typedTotal > 0 ? Math.round((foliarCount / typedTotal) * 100) : 0,
      countries,
      regions,
      languages: countMapEntries(languageCounts),
      crops,
      months,
      trends,
      sampleTypes,
      featured: feedbackRows?.[0] || null,
      withCountry,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
