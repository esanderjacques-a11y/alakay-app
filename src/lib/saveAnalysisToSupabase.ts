import { supabase } from "@/lib/supabase";

export type AnalysisResultValue = {
  parameter_id: number | null;
  custom_parameter_id: number | null;
  unit_id: number;
  value: number;
  min: number | null;
  max: number | null;
  level_code: string;
  final_group_code: string;
  confidence: string;
  is_proxy: boolean;
  source_name: string | null;
  advice: string;
};

export type SaveAnalysisInput = {
  userId: string;
  cropId: number;
  sampleType: "soil" | "foliar";
  results: AnalysisResultValue[];
  farmName: string;
  lotName: string;
  labName: string;
  analysisName: string;
  samplingDate: string;
  reportDate: string;
  country: string | null;
  provinceState: string | null;
  editingRootAnalysisId: number | null;
  editingNextVersionNumber: number;
};

export type SaveAnalysisOutput = {
  analysisId: number;
  versionNumber: number;
  isVersionSave: boolean;
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function saveAnalysisToSupabase(
  input: SaveAnalysisInput
): Promise<SaveAnalysisOutput> {
  const sampleTypeId = input.sampleType === "soil" ? 1 : 2;
  const userId = input.userId;

  let farmId: number | null = null;
  let lotId: number | null = null;
  let labId: number | null = null;

  if (input.farmName.trim()) {
    const { data: farmData, error: farmError } = await supabase
      .from("farms")
      .insert({
        user_id: userId,
        farm_name: input.farmName.trim(),
        location: [(input.provinceState || "").trim(), input.country || ""]
          .filter(Boolean)
          .join(", "),
      })
      .select("farm_id")
      .single();

    if (farmError) {
      throw new Error(farmError.message);
    }

    farmId = farmData.farm_id;
  }

  if (input.lotName.trim() && farmId) {
    const { data: lotData, error: lotError } = await supabase
      .from("lots")
      .insert({
        farm_id: farmId,
        lot_name: input.lotName.trim(),
      })
      .select("lot_id")
      .single();

    if (lotError) {
      throw new Error(lotError.message);
    }

    lotId = lotData.lot_id;
  }

  if (input.labName.trim()) {
    const { data: labData, error: labError } = await supabase
      .from("labs")
      .insert({
        user_id: userId,
        lab_name: input.labName.trim(),
      })
      .select("lab_id")
      .single();

    if (labError) {
      throw new Error(labError.message);
    }

    labId = labData.lab_id;
  }

  const versionNumber = input.editingRootAnalysisId
    ? input.editingNextVersionNumber
    : 1;

  const { data: analysisData, error: analysisError } = await supabase
    .from("analyses")
    .insert({
      user_id: userId,
      crop_id: input.cropId,
      sample_type_id: sampleTypeId,
      farm_id: farmId,
      lot_id: lotId,
      lab_id: labId,
      parent_analysis_id: input.editingRootAnalysisId,
      version_number: versionNumber,
      is_deleted: false,
      analysis_name:
        input.analysisName.trim() ||
        `${input.sampleType} analysis - ${new Date().toLocaleDateString()}`,
      sampling_date: input.samplingDate || getTodayIsoDate(),
      report_date: input.reportDate || null,
      country: input.country || null,
      province_state: (input.provinceState || "").trim() || null,
      latitude: null,
      longitude: null,
      location_source:
        input.country || (input.provinceState || "").trim() ? "manual" : null,
      status: "completed",
    })
    .select("analysis_id")
    .single();

  if (analysisError) {
    throw new Error(analysisError.message);
  }

  const analysisId = analysisData.analysis_id;

  const valuesToInsert = input.results.map((result) => ({
    analysis_id: analysisId,
    parameter_id: result.parameter_id,
    custom_parameter_id: result.custom_parameter_id || null,
    unit_id: result.unit_id,
    value: result.value,
    min: result.min,
    max: result.max,
    level_code: result.level_code,
    group_code: result.final_group_code,
    confidence: result.confidence,
    is_proxy: result.is_proxy,
    source_name: result.source_name,
    advice: result.advice,
  }));

  const { error: valuesError } = await supabase
    .from("analysis_values")
    .insert(valuesToInsert);

  if (valuesError) {
    throw new Error(valuesError.message);
  }

  return {
    analysisId,
    versionNumber,
    isVersionSave: Boolean(input.editingRootAnalysisId),
  };
}
