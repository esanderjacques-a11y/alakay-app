import {
  canConvertLabUnit,
  convertLabUnit,
  roundConvertedValue,
} from "@/lib/unitConversions";
import { TABLE_6_CMOL_TO_MGKG } from "@/lib/soilFertilityTables";

export type ImportUnitConversionOffer = {
  rowId: string;
  parameterLabel: string;
  fromUnit: string;
  toUnit: string;
  fromValue: number;
  toValue: number;
  kind: "base_to_cmol" | "to_preferred";
};

type ParameterLike = {
  parameter_key: string;
  parameter_name: string;
  display_name: string;
  symbol: string | null;
  unit_id: number;
  unit_symbol: string;
  preferred_display_symbol?: string;
  available_units: {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
  }[];
};

type RowLike = {
  id: string;
  matchedParameterKey: string | null;
  value: string;
  unit: string | null;
  selectedUnitId: number | null;
  selectedUnitDisplayKey: string | null;
  selected?: boolean;
};

function cleanUnit(unit: string) {
  return unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/\u207b/g, "-")
    .replace(/\u00b7/g, ".");
}

function unitsEquivalent(left: string, right: string) {
  if (!left || !right) return false;
  if (cleanUnit(left) === cleanUnit(right)) return true;
  return canConvertLabUnit(left, right) && convertLabUnit(1, left, right)?.value === 1;
}

function isMassUnit(unit: string) {
  const u = cleanUnit(unit);
  return (
    u === "ppm" ||
    u === "mg/kg" ||
    u === "mgkg-1" ||
    u === "mg.kg-1" ||
    u === "ug/g"
  );
}

function isCmolUnit(unit: string) {
  const u = cleanUnit(unit);
  return (
    u.includes("cmol") ||
    u.includes("meq/100g") ||
    u.includes("meq100g") ||
    u.includes("cmolc")
  );
}

function isPercentUnit(unit: string) {
  const u = cleanUnit(unit);
  return u === "%" || u === "percent" || u === "g/100g" || u === "dag/kg";
}

function normalizeParameterText(parameter: ParameterLike) {
  return `${parameter.parameter_name} ${parameter.display_name} ${parameter.symbol || ""} ${parameter.parameter_key}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Tabla N.° 6 cations + Al³⁺ (≈90 mg/kg per cmol(+)/kg). */
function cationMassPerCmol(parameter: ParameterLike): number | null {
  const text = normalizeParameterText(parameter);
  if (/\b(h\+al|h al|acidez|acidity|extractable acidity|acidez extractable|acidez intercambiable)\b/.test(text)) {
    return 89.9;
  }
  if (/\b(al|aluminum|aluminium|aluminio)\b/.test(text) && !/\bh\+al|h al\b/.test(text)) {
    return 89.9;
  }
  if (/\b(ca|calcium|calcio)\b/.test(text)) return TABLE_6_CMOL_TO_MGKG.ca;
  if (/\b(mg|magnesium|magnesio)\b/.test(text)) return TABLE_6_CMOL_TO_MGKG.mg;
  if (/\b(k|potassium|potasio)\b/.test(text) && !/\bnk|npk\b/.test(text)) {
    return TABLE_6_CMOL_TO_MGKG.k;
  }
  if (/\b(na|sodium|sodio)\b/.test(text)) return TABLE_6_CMOL_TO_MGKG.na;
  return null;
}

function prefersExchangeCmol(parameter: ParameterLike) {
  const preferred = preferredUnitLabel(parameter);
  return isCmolUnit(preferred);
}

/** Soil exchange bases / acidity / extractable Al should be offered as cmol(+)/kg. */
function shouldOfferMassToCmol(parameter: ParameterLike) {
  if (!cationMassPerCmol(parameter)) return false;
  if (prefersExchangeCmol(parameter)) return true;
  const text = normalizeParameterText(parameter);
  return (
    /\b(acidez|acidity|h\+al|h al)\b/.test(text) ||
    (/\b(al|aluminum|aluminium|aluminio)\b/.test(text) &&
      /\b(extractable|exchangeable|intercambiable|extractable)\b/.test(text))
  );
}

export function preferredUnitLabel(parameter: ParameterLike) {
  return (
    parameter.preferred_display_symbol ||
    parameter.unit_symbol ||
    parameter.available_units[0]?.display_symbol ||
    parameter.available_units[0]?.unit_symbol ||
    ""
  ).trim();
}

function currentUnitLabel(row: RowLike, parameter: ParameterLike) {
  if (row.selectedUnitDisplayKey) {
    const option = parameter.available_units.find(
      (unit) =>
        `${unit.unit_id}::${unit.display_symbol || unit.unit_symbol}` ===
        row.selectedUnitDisplayKey
    );
    if (option) return option.display_symbol || option.unit_symbol;
  }
  if (row.unit?.trim()) return row.unit.trim();
  const byId = parameter.available_units.find(
    (unit) => unit.unit_id === row.selectedUnitId
  );
  if (byId) return byId.display_symbol || byId.unit_symbol;
  return preferredUnitLabel(parameter);
}

function convertExchangeValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  parameter: ParameterLike
): number | null {
  const factor = cationMassPerCmol(parameter);
  if (!factor) return null;

  if (isMassUnit(fromUnit) && isCmolUnit(toUnit)) {
    return roundConvertedValue(value / factor, 3);
  }
  if (isCmolUnit(fromUnit) && isMassUnit(toUnit)) {
    return roundConvertedValue(value * factor, 2);
  }
  return null;
}

export function convertImportValueToUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
  parameter: ParameterLike
): { value: number; note: string } | null {
  if (!Number.isFinite(value) || !fromUnit || !toUnit) return null;
  if (unitsEquivalent(fromUnit, toUnit)) {
    return { value, note: "equivalent" };
  }

  // Prefer cation charge factors for bases / Al / extractable acidity (ppm ↔ cmol).
  const exchange = convertExchangeValue(value, fromUnit, toUnit, parameter);
  if (exchange !== null) {
    return {
      value: exchange,
      note: "Converted with cation charge factor (mg/kg ↔ cmol(+)/kg).",
    };
  }

  const simple = convertLabUnit(value, fromUnit, toUnit);
  if (simple) {
    return { value: simple.value, note: simple.note };
  }

  return null;
}

function findTargetUnitOption(parameter: ParameterLike, toUnit: string) {
  const cleaned = cleanUnit(toUnit);
  const exact = parameter.available_units.find((unit) => {
    const display = cleanUnit(unit.display_symbol || "");
    const symbol = cleanUnit(unit.unit_symbol || "");
    return display === cleaned || symbol === cleaned;
  });
  if (exact) return exact;

  return (
    parameter.available_units.find((unit) =>
      canConvertLabUnit(unit.unit_symbol || unit.display_symbol, toUnit)
    ) ||
    parameter.available_units.find((unit) => unit.unit_id === parameter.unit_id) ||
    parameter.available_units[0] ||
    null
  );
}

export function collectImportUnitConversionOffers(
  rows: RowLike[],
  parameterByKey: Map<string, ParameterLike>
): ImportUnitConversionOffer[] {
  const offers: ImportUnitConversionOffer[] = [];

  for (const row of rows) {
    if (!row.matchedParameterKey) continue;
    const parameter = parameterByKey.get(row.matchedParameterKey);
    if (!parameter) continue;

    const value = Number(String(row.value).replace(",", "."));
    if (!Number.isFinite(value)) continue;

    const fromUnit = currentUnitLabel(row, parameter);
    let toUnit = preferredUnitLabel(parameter);

    // Soil bases / Al / acidity in ppm or mg/kg → offer cmol(+)/kg even if
    // preferred_display_symbol still points at a mass label.
    if (shouldOfferMassToCmol(parameter) && isMassUnit(fromUnit)) {
      toUnit = isCmolUnit(toUnit) ? toUnit : "cmol(+)/kg";
    }

    if (!fromUnit || !toUnit) continue;
    if (unitsEquivalent(fromUnit, toUnit)) continue;

    const converted = convertImportValueToUnit(value, fromUnit, toUnit, parameter);
    if (!converted) continue;

    const kind =
      shouldOfferMassToCmol(parameter) && isMassUnit(fromUnit) && isCmolUnit(toUnit)
        ? "base_to_cmol"
        : "to_preferred";

    // Skip noise: percent↔percent-looking or tiny no-op already filtered.
    if (
      kind === "to_preferred" &&
      isPercentUnit(fromUnit) &&
      isPercentUnit(toUnit)
    ) {
      continue;
    }

    offers.push({
      rowId: row.id,
      parameterLabel: parameter.display_name || parameter.parameter_name,
      fromUnit,
      toUnit,
      fromValue: value,
      toValue: converted.value,
      kind,
    });
  }

  return offers;
}

export function applyImportUnitConversionOffers<T extends RowLike>(
  rows: T[],
  offers: ImportUnitConversionOffer[],
  parameterByKey: Map<string, ParameterLike>,
  getUnitOptionKey: (unit: {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
  }) => string
): T[] {
  const byRowId = new Map(offers.map((offer) => [offer.rowId, offer]));

  return rows.map((row) => {
    const offer = byRowId.get(row.id);
    if (!offer || !row.matchedParameterKey) return row;
    const parameter = parameterByKey.get(row.matchedParameterKey);
    if (!parameter) return row;

    const targetOption = findTargetUnitOption(parameter, offer.toUnit);
    if (!targetOption) {
      return {
        ...row,
        value: String(offer.toValue),
        unit: offer.toUnit,
      };
    }

    const displayKey = getUnitOptionKey({
      unit_id: targetOption.unit_id,
      unit_symbol: targetOption.unit_symbol,
      display_symbol: isCmolUnit(offer.toUnit)
        ? targetOption.display_symbol || targetOption.unit_symbol
        : cleanUnit(offer.toUnit) === "ppm"
          ? "ppm"
          : targetOption.display_symbol || targetOption.unit_symbol,
    });

    return {
      ...row,
      value: String(offer.toValue),
      unit: offer.toUnit,
      selectedUnitId: targetOption.unit_id,
      selectedUnitDisplayKey: displayKey,
    };
  });
}
