import { supabase } from "@/lib/supabase";
import { Language } from "@/lib/translations";

type UnitAliasRow = {
  unit_id?: number | null;
  priority?: number | null;
  language_code?: string | null;
  language?: string | null;
  lang?: string | null;
  locale?: string | null;
  alias?: string | null;
  unit_alias?: string | null;
  alias_name?: string | null;
  translated_symbol?: string | null;
  display_symbol?: string | null;
  unit_symbol?: string | null;
};

export async function loadCropAliasMap(
  language: Language,
  cropIds: number[]
) {
  if (cropIds.length === 0) return new Map<number, string>();

  const { data, error } = await supabase
    .from("crop_aliases")
    .select("crop_id, alias_name, priority")
    .eq("language", language)
    .in("crop_id", cropIds)
    .order("priority", { ascending: true });

  if (error) {
    console.warn("Crop alias loading error:", error.message);
    return new Map<number, string>();
  }

  const map = new Map<number, string>();

  for (const row of data || []) {
    if (!map.has(row.crop_id)) {
      map.set(row.crop_id, row.alias_name);
    }
  }

  return map;
}

export async function loadParameterAliasMap(
  language: Language,
  parameterIds: number[]
) {
  if (parameterIds.length === 0) return new Map<number, string>();

  const { data, error } = await supabase
    .from("parameter_aliases")
    .select("parameter_id, alias_name, priority")
    .eq("language", language)
    .in("parameter_id", parameterIds)
    .order("priority", { ascending: true });

  if (error) {
    console.warn("Parameter alias loading error:", error.message);
    return new Map<number, string>();
  }

  const map = new Map<number, string>();

  for (const row of data || []) {
    if (!map.has(row.parameter_id)) {
      map.set(row.parameter_id, row.alias_name);
    }
  }

  return map;
}

export async function loadUnitAliasMap(language: Language, unitIds: number[]) {
  if (unitIds.length === 0) return new Map<number, string>();

  const { data, error } = await supabase
    .from("unit_aliases")
    .select("*")
    .in("unit_id", unitIds);

  if (error) {
    console.warn("Unit alias loading error:", error.message);
    return new Map<number, string>();
  }

  const map = new Map<number, string>();

  const rows = ((data || []) as UnitAliasRow[])
    .filter((row) => {
      const aliasLanguage =
        row.language_code || row.language || row.lang || row.locale || null;

      return (
        !aliasLanguage ||
        aliasLanguage === language ||
        aliasLanguage === "all" ||
        aliasLanguage === "universal"
      );
    })
    .sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999));

  for (const row of rows) {
    const aliasText =
      row.alias ||
      row.unit_alias ||
      row.alias_name ||
      row.translated_symbol ||
      row.display_symbol ||
      row.unit_symbol ||
      "";

    if (row.unit_id && aliasText && !map.has(row.unit_id)) {
      map.set(row.unit_id, aliasText);
    }
  }

  return map;
}

export async function loadUnitAliasOptionsMap(
  language: string,
  unitIds: number[]
) {
  const { supabase } = await import("@/lib/supabase");

  const uniqueUnitIds = Array.from(new Set(unitIds)).filter(
    (id) => typeof id === "number"
  );

  const map = new Map<
    number,
    {
      unit_id: number;
      unit_symbol: string;
      display_symbol: string;
    }[]
  >();

  if (uniqueUnitIds.length === 0) return map;

  const { data: unitsData } = await supabase
    .from("units")
    .select("unit_id, unit_symbol")
    .in("unit_id", uniqueUnitIds);

  const baseUnits = unitsData || [];

  for (const unit of baseUnits) {
    map.set(unit.unit_id, [
      {
        unit_id: unit.unit_id,
        unit_symbol: unit.unit_symbol,
        display_symbol: unit.unit_symbol,
      },
    ]);
  }

  const { data: aliasesData, error } = await supabase
    .from("unit_aliases")
    .select("*")
    .in("unit_id", uniqueUnitIds);

  if (error || !aliasesData) {
    return map;
  }

  for (const aliasRow of aliasesData as UnitAliasRow[]) {
    const unitId = aliasRow.unit_id;

    if (!unitId) continue;

    const aliasLanguage =
      aliasRow.language_code ||
      aliasRow.language ||
      aliasRow.lang ||
      aliasRow.locale ||
      null;

    const aliasText =
      aliasRow.alias ||
      aliasRow.unit_alias ||
      aliasRow.alias_name ||
      aliasRow.translated_symbol ||
      aliasRow.display_symbol ||
      aliasRow.unit_symbol ||
      "";

    if (!aliasText) continue;

    if (
      aliasLanguage &&
      aliasLanguage !== language &&
      aliasLanguage !== "all" &&
      aliasLanguage !== "universal"
    ) {
      continue;
    }

    const existing = map.get(unitId) || [];

    const alreadyExists = existing.some(
      (item) =>
        item.display_symbol.toLowerCase().trim() ===
        String(aliasText).toLowerCase().trim()
    );

    if (!alreadyExists) {
      const baseUnit = baseUnits.find((unit) => unit.unit_id === unitId);

      existing.push({
        unit_id: unitId,
        unit_symbol: baseUnit?.unit_symbol || aliasText,
        display_symbol: aliasText,
      });

      map.set(unitId, existing);
    }
  }

  return map;
}
