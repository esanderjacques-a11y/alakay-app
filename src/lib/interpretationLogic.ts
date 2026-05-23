type LogicInput = {
  parameter_id?: number;
  parameter_name: string;
  value: number;
  min: number | null;
  max: number | null;
};

function normalizeName(name: string) {
  return name.toLowerCase().trim();
}

function isBulkDensity(name: string) {
  const n = normalizeName(name);
  return n.includes("bulk density") || n.includes("densidad aparente");
}

function isPH(name: string) {
  const n = normalizeName(name);
  return n === "ph" || n.includes("soil ph") || n.includes("pH".toLowerCase());
}

function isElectricalConductivity(name: string) {
  const n = normalizeName(name);
  return (
    n.includes("electrical conductivity") ||
    n === "ec" ||
    n.includes("conductividad eléctrica") ||
    n.includes("conductivite")
  );
}

function isSodium(name: string) {
  const n = normalizeName(name);
  return (
    n === "na" ||
    n.includes("sodium") ||
    n.includes("sodio") ||
    n.includes("sodium exchangeable")
  );
}

function isAluminum(name: string) {
  const n = normalizeName(name);
  return n === "al" || n.includes("aluminum") || n.includes("aluminio");
}

export function getLevelCode(input: LogicInput) {
  const name = input.parameter_name;
  const value = input.value;
  const min = input.min;
  const max = input.max;

  if (isBulkDensity(name)) {
    if (value > 1.65) return "very_high";
    if (value > 1.45) return "high";
    return "acceptable";
  }

  if (isElectricalConductivity(name)) {
    if (value >= 4) return "very_high";
    if (value >= 2) return "high";
    return "acceptable";
  }

  if (isPH(name)) {
    if (value < 6.5) return "acidic";
    if (value > 7.5) return "alkaline";
    return "neutral_ph";
  }

  if (isSodium(name)) {
    if (value > 2) return "very_high";
    if (value > 1) return "high";
    if (value >= 0.5) return "moderate";
    return "acceptable";
  }

  if (isAluminum(name)) {
    if (max !== null && value > max) return "high";
    return "acceptable";
  }

  if (min !== null && value < min) return "low";
  if (max !== null && value > max) return "high";
  return "normal";
}

export function getFinalGroupCode(input: LogicInput) {
  const level = getLevelCode(input);
  const name = input.parameter_name;

  if (isBulkDensity(name)) {
    if (level === "very_high" || level === "high") return "negative";
    return "normal";
  }

  if (isPH(name)) {
    if (level === "acidic" || level === "alkaline" || level === "low" || level === "high") return "warning";
    return "normal";
  }

  if (isElectricalConductivity(name)) {
    if (level === "very_high" || level === "high") return "negative";
    return "normal";
  }

  if (isSodium(name)) {
    if (level === "very_high" || level === "high") return "negative";
    if (level === "moderate") return "warning";
    return "normal";
  }

  if (isAluminum(name)) {
    if (level === "high") return "negative";
    return "normal";
  }

  if (level === "low") return "warning";
  if (level === "high" || level === "very_high") return "warning";
  if (level === "normal" || level === "acceptable") return "normal";

  return "neutral";
}

export function getSimpleAdvice(input: LogicInput) {
  const name = input.parameter_name;
  const value = input.value;
  const level = getLevelCode(input);

  if (isBulkDensity(name)) {
    if (value > 1.65) {
      return "Bulk density is high. This may indicate soil compaction, reduced root growth, poor aeration, and lower water infiltration. Consider improving organic matter, reducing heavy traffic, using cover crops, and evaluating deep tillage only if compaction is confirmed.";
    }

    if (value > 1.45) {
      return "Bulk density is moderately high. Monitor compaction risk, especially in clayey or intensively managed soils.";
    }

    return "Bulk density is within an acceptable range for many agricultural soils.";
  }

  if (isPH(name)) {
    if (level === "acidic" || level === "low") {
      return "Soil pH is acidic. This can reduce nutrient availability and increase aluminum toxicity risk. Consider confirming acidity with exchangeable acidity or aluminum data before applying lime.";
    }

    if (level === "alkaline" || level === "high") {
      return "Soil pH is alkaline. Some nutrients such as phosphorus, iron, zinc, manganese, and copper may become less available. Avoid unnecessary liming and review crop-specific tolerance.";
    }

    return "Soil pH is near neutral in the current context.";
  }

  if (isElectricalConductivity(name)) {
    if (level === "very_high") {
      return "Electrical conductivity is high. This suggests salinity risk, which can reduce water uptake and crop growth. Check irrigation water quality, drainage, sodium, and salt accumulation before planning correction.";
    }

    if (level === "high") {
      return "Electrical conductivity is elevated. Monitor salinity risk and check irrigation, drainage, and sodium levels.";
    }

    return "Electrical conductivity does not indicate major salinity risk based on the current reference range.";
  }

  if (isSodium(name)) {
    if (level === "very_high") {
      return "Sodium is highly sodic (>2.0 cmol(+)/kg). Severe structural and infiltration problems are likely. Review EC, SAR/ESP, drainage, calcium status, and gypsum requirement urgently.";
    }

    if (level === "high") {
      return "Sodium is sodic/problematic (>1.0 cmol(+)/kg). Soil structure, infiltration, and root development can be affected. Check EC, SAR/ESP, calcium, drainage, and gypsum requirement.";
    }

    if (level === "moderate") {
      return "Sodium is slightly elevated (0.5-1.0 cmol(+)/kg). Monitor EC and structure risk, especially in sensitive soils or low-drainage conditions.";
    }

    return "Sodium is in the safe range (<0.5 cmol(+)/kg) based on the current reference.";
  }

  if (isAluminum(name)) {
    if (level === "high") {
      return "Aluminum is high. This can damage roots in acidic soils and reduce nutrient uptake. Review soil pH and acidity correction options such as liming.";
    }

    return "Aluminum is within the expected range based on the current reference.";
  }

  if (level === "low") {
    return "This value is below the reference range. Review crop demand, soil conditions, and possible correction options before applying inputs.";
  }

  if (level === "high") {
    return "This value is above the reference range. Check whether this indicates excess, toxicity risk, imbalance, or simply high availability depending on the parameter.";
  }

  if (level === "very_high") {
    return "This value is very high and may require closer review before making management decisions.";
  }

  return "This value is within the current reference range.";
}
