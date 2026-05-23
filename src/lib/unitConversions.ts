export type UnitConversion = {
  value: number;
  unit: string;
  note: string;
};

function cleanUnit(unit: string) {
  return unit
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
    ["ppm", "mg/kg", "mgkg-1", "mg.kg-1"],
    ["cmol(+)/kg", "cmolc/kg", "cmol/kg", "meq/100g"],
    ["%", "percent", "g/100g"],
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
    "ds/m->ms/cm": 1,
    "ms/cm->ds/m": 1,
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

