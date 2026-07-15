import { supabase } from "@/lib/supabase";
import { parseLotNames } from "@/lib/farmLots";

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
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: "gps" | "manual" | null;
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
  let lotIds: number[] = [];
  let labId: number | null = null;

  if (input.farmName.trim()) {
    const farmName = input.farmName.trim();
    const location = [(input.provinceState || "").trim(), input.country || ""]
      .filter(Boolean)
      .join(", ");
    const { data: existingFarms, error: farmLookupError } = await supabase
      .from("farms")
      .select("farm_id, farm_name, location")
      .eq("user_id", userId);
    if (farmLookupError) throw new Error(farmLookupError.message);

    const normalize = (value: string | null | undefined) =>
      (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase();
    const identity = `${normalize(farmName)}||${normalize(location)}`;

    const existingFarm = existingFarms?.find(
      (farm) =>
        `${normalize(farm.farm_name)}||${normalize(farm.location)}` === identity
    );
    if (existingFarm) {
      farmId = existingFarm.farm_id;
    } else {
      // Prefer an existing same-name farm when location was never set.
      const sameNameEmptyLoc = existingFarms?.find(
        (farm) =>
          normalize(farm.farm_name) === normalize(farmName) &&
          !normalize(farm.location)
      );
      if (sameNameEmptyLoc && location) {
        const { error: locError } = await supabase
          .from("farms")
          .update({ location })
          .eq("farm_id", sameNameEmptyLoc.farm_id);
        if (locError) throw new Error(locError.message);
        farmId = sameNameEmptyLoc.farm_id;
      } else {
        const { data: farmData, error: farmError } = await supabase
          .from("farms")
          .insert({
            user_id: userId,
            farm_name: farmName,
            location: location || null,
          })
          .select("farm_id")
          .single();

        if (farmError) throw new Error(farmError.message);
        farmId = farmData.farm_id;
      }
    }
  }

  const requestedLotNames = parseLotNames(input.lotName);
  if (requestedLotNames.length > 0 && farmId) {
    const { data: existingLots, error: lotLookupError } = await supabase
      .from("lots")
      .select("lot_id, lot_name")
      .eq("farm_id", farmId);
    if (lotLookupError) throw new Error(lotLookupError.message);

    const lotsByName = new Map(
      (existingLots || []).map((lot) => [
        lot.lot_name.trim().toLocaleLowerCase(),
        lot,
      ])
    );
    const missingNames = requestedLotNames.filter(
      (name) => !lotsByName.has(name.toLocaleLowerCase())
    );
    if (missingNames.length > 0) {
      const { data: insertedLots, error: lotError } = await supabase
        .from("lots")
        .insert(missingNames.map((name) => ({ farm_id: farmId, lot_name: name })))
        .select("lot_id, lot_name");
      if (lotError) throw new Error(lotError.message);
      for (const lot of insertedLots || []) {
        lotsByName.set(lot.lot_name.trim().toLocaleLowerCase(), lot);
      }
    }

    lotIds = requestedLotNames
      .map((name) => lotsByName.get(name.toLocaleLowerCase())?.lot_id)
      .filter((id): id is number => typeof id === "number");
    lotId = lotIds[0] || null;
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
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      location_source:
        input.locationSource ||
        (input.country || (input.provinceState || "").trim() ? "manual" : null),
      status: "completed",
    })
    .select("analysis_id")
    .single();

  if (analysisError) {
    throw new Error(analysisError.message);
  }

  const analysisId = analysisData.analysis_id;

  if (lotIds.length > 0) {
    const { error: analysisLotsError } = await supabase
      .from("analysis_lots")
      .insert(
        lotIds.map((assignedLotId, index) => ({
          analysis_id: analysisId,
          lot_id: assignedLotId,
          is_primary: index === 0,
        }))
      );
    if (analysisLotsError) throw new Error(analysisLotsError.message);
  }

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
