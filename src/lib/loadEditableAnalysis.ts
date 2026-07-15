import { supabase } from "@/lib/supabase";
import type { EditableAnalysisPayload } from "@/components/AnalysisHistory";

type AnalysisRow = {
  analysis_id: number;
  analysis_name: string | null;
  crop_id: number | null;
  sample_type_id: number | null;
  parent_analysis_id: number | null;
  version_number: number | null;
  is_deleted: boolean | null;
  sampling_date: string | null;
  report_date: string | null;
  country: string | null;
  province_state: string | null;
  farms: { farm_name: string } | { farm_name: string }[] | null;
  lots: { lot_name: string } | { lot_name: string }[] | null;
  analysis_lots:
    | Array<{
        is_primary: boolean;
        lots: { lot_name: string } | { lot_name: string }[] | null;
      }>
    | null;
  labs: { lab_name: string } | { lab_name: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function sampleType(analysis: AnalysisRow): "soil" | "foliar" {
  return analysis.sample_type_id === 2 ? "foliar" : "soil";
}

function lotName(analysis: AnalysisRow) {
  const assigned = (analysis.analysis_lots || [])
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((row) => one(row.lots)?.lot_name?.trim())
    .filter((name): name is string => Boolean(name));
  if (assigned.length > 0) return [...new Set(assigned)].join(", ");
  return one(analysis.lots)?.lot_name || "";
}

/** Build the payload used by Values edit flow for a saved analysis. */
export async function loadEditableAnalysisById(
  userId: string,
  analysisId: number
): Promise<EditableAnalysisPayload> {
  const { data: analysis, error } = await supabase
    .from("analyses")
    .select(
      `
      analysis_id,
      analysis_name,
      crop_id,
      sample_type_id,
      parent_analysis_id,
      version_number,
      is_deleted,
      sampling_date,
      report_date,
      country,
      province_state,
      farms ( farm_name ),
      lots!analyses_lot_id_fkey ( lot_name ),
      analysis_lots (
        is_primary,
        lots ( lot_name )
      ),
      labs ( lab_name )
    `
    )
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!analysis) throw new Error("Analysis not found.");

  const row = analysis as AnalysisRow;
  if (row.is_deleted) {
    throw new Error("Restore this report before editing it.");
  }

  const rootId = row.parent_analysis_id || row.analysis_id;

  const { data: siblings, error: siblingError } = await supabase
    .from("analyses")
    .select("analysis_id, parent_analysis_id, version_number")
    .eq("user_id", userId)
    .or(`analysis_id.eq.${rootId},parent_analysis_id.eq.${rootId}`);

  if (siblingError) throw new Error(siblingError.message);

  const maxVersion = Math.max(
    1,
    ...((siblings || []) as Array<{ version_number: number | null }>).map(
      (item) => item.version_number || 1
    )
  );
  const nextVersion = maxVersion + 1;

  const { data: values, error: valuesError } = await supabase
    .from("analysis_values")
    .select("parameter_id, custom_parameter_id, value, unit_id")
    .eq("analysis_id", analysisId);

  if (valuesError) throw new Error(valuesError.message);

  const valueMap: Record<string, string> = {};
  const unitMap: Record<string, number> = {};

  for (const item of values || []) {
    let parameterKey = "";
    if (typeof item.custom_parameter_id === "number") {
      parameterKey = `c-${item.custom_parameter_id}`;
    } else if (typeof item.parameter_id === "number") {
      parameterKey = `p-${item.parameter_id}`;
    }
    if (!parameterKey) continue;
    valueMap[parameterKey] = String(item.value ?? "");
    if (typeof item.unit_id === "number") {
      unitMap[parameterKey] = item.unit_id;
    }
  }

  const farm = one(row.farms)?.farm_name || "";
  const lab = one(row.labs)?.lab_name || "";

  return {
    analysisId: row.analysis_id,
    rootAnalysisId: rootId,
    nextVersionNumber: nextVersion,
    cropId: row.crop_id || "",
    sampleType: sampleType(row),
    analysisName: row.analysis_name
      ? `${row.analysis_name} - v${nextVersion}`
      : `Analysis #${row.analysis_id} - v${nextVersion}`,
    farmName: farm,
    lotName: lotName(row),
    labName: lab,
    country: row.country || "",
    provinceState: row.province_state || "",
    samplingDate: row.sampling_date || "",
    reportDate: row.report_date || "",
    values: valueMap,
    selectedUnits: unitMap,
  };
}

export async function softDeleteAnalysis(userId: string, analysisId: number) {
  const { error } = await supabase
    .from("analyses")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("analysis_id", analysisId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
