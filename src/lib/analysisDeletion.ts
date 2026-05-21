import { getPermanentDeleteDays } from "@/lib/appSettings";
import { supabase } from "@/lib/supabase";

export function getDeletedAnalysisRetentionDays() {
  return getPermanentDeleteDays();
}

export function getRetentionCutoffIso() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - getDeletedAnalysisRetentionDays());
  return cutoff.toISOString();
}

export function getDaysUntilPermanentDelete(deletedAt: string | null) {
  const retentionDays = getDeletedAnalysisRetentionDays();
  if (!deletedAt) return retentionDays;

  const purgeAt = new Date(deletedAt);
  purgeAt.setDate(purgeAt.getDate() + retentionDays);

  const remainingMs = purgeAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
}

export async function backfillMissingDeletedAt(userId: string) {
  const { error } = await supabase
    .from("analyses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_deleted", true)
    .is("deleted_at", null);

  if (error) {
    console.warn("backfill deleted_at:", error.message);
  }
}

export async function purgeExpiredDeletedAnalyses(userId: string) {
  const cutoff = getRetentionCutoffIso();

  const { data, error } = await supabase
    .from("analyses")
    .select("analysis_id")
    .eq("user_id", userId)
    .eq("is_deleted", true)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (error) {
    console.warn("purge expired analyses:", error.message);
    return 0;
  }

  let removed = 0;

  for (const row of data || []) {
    await deleteAnalysisPermanently(row.analysis_id, userId);
    removed += 1;
  }

  return removed;
}

export async function deleteAnalysisPermanently(
  analysisId: number,
  userId: string
) {
  const { error: valuesError } = await supabase
    .from("analysis_values")
    .delete()
    .eq("analysis_id", analysisId);

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  const { error } = await supabase
    .from("analyses")
    .delete()
    .eq("analysis_id", analysisId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
