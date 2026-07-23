export type UnitConversion = {
  value: number;
  unit: string;
  note: string;
};

function cleanUnit(unit: string) {
  const withCaseSensitiveSymbols = unit
    .replace(/\bMg\s*\/\s*m(?:3|\^3|³)\b/g, "megagram/m3")
    .replace(/\bMg\s*m(?:-3|⁻3|−3)\b/g, "megagram/m3");

  return withCaseSensitiveSymbols
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/\u207b/g, "-")
    .replace(/\u00b7/g, ".");
}

export function roundConvertedValue(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function convertLabUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): UnitConversion | null {
  if (!Number.isFinite(value)) return null;

  const from = cleanUnit(fromUnit);
  const to = cleanUnit(toUnit);

  if (!from || !to || from === to) {
    return {
      value: roundConvertedValue(value),
      unit: toUnit,
      note: "Same unit; no conversion was needed.",
    };
  }

  const equivalentGroups = [
    ["ppm", "mg/kg", "mgkg-1", "mg.kg-1", "ug/g"],
    [
      "cmol(+)/kg",
      "cmolc/kg",
      "cmol/kg",
      "cmol(+)kg-1",
      "cmolckg-1",
      "cmolkg-1",
      "meq/100g",
      "meq/100g-1",
      "meq100g-1",
    ],
    ["%", "percent", "g/100g", "dag/kg", "dagkg-1"],
    ["g/cm3", "g/cm^3", "gcm-3", "megagram/m3"],
    ["ds/m", "dsm-1", "ms/cm", "mscm-1", "mmhos/cm", "mmhoscm-1", "mmho/cm", "mmhocm-1"],
  ];

  if (equivalentGroups.some((group) => group.includes(from) && group.includes(to))) {
    return {
      value: roundConvertedValue(value),
      unit: toUnit,
      note: "These units are treated as equivalent for routine soil/foliar review.",
    };
  }

  const factors: Record<string, number> = {
    "g/kg->%": 0.1,
    "%->g/kg": 10,
    "us/cm->ms/cm": 0.001,
    "ms/cm->us/cm": 1000,
    "us/cm->ds/m": 0.001,
    "ds/m->us/cm": 1000,
  };

  const factor = factors[`${from}->${to}`];
  if (factor === undefined) return null;

  return {
    value: roundConvertedValue(value * factor),
    unit: toUnit,
    note: "Converted after unit selection.",
  };
}

export function canConvertLabUnit(fromUnit: string, toUnit: string) {
  return convertLabUnit(1, fromUnit, toUnit) !== null;
}

const MASS_PERCENT_UNITS = new Set([
  "%",
  "percent",
  "g/100g",
  "dag/kg",
  "dagkg-1",
]);

const MASS_PPM_UNITS = new Set([
  "ppm",
  "mg/kg",
  "mgkg-1",
  "mg.kg-1",
  "ug/g",
]);

/** Foliar/soil mass concentration as % dry matter (1% = 10 000 ppm).
 *  Graphs only — do not use for DOP (value vs range optimum must stay in native units).
 */
export function toMassPercent(
  value: number,
  unit: string | undefined | null,
  options?: { assumePpmWhenUnitMissing?: boolean }
): number | null {
  if (!Number.isFinite(value)) return null;

  const from = cleanUnit(String(unit || ""));
  if (!from) {
    if (options?.assumePpmWhenUnitMissing) {
      return value / 10000;
    }
    return null;
  }

  if (MASS_PERCENT_UNITS.has(from)) {
    return value;
  }

  if (MASS_PPM_UNITS.has(from)) {
    return value / 10000;
  }

  // g/kg → % (and other safe mass-fraction pairs already in convertLabUnit)
  if (from === "g/kg" || from === "gkg-1" || from === "g.kg-1") {
    return value / 10;
  }

  return null;
}
