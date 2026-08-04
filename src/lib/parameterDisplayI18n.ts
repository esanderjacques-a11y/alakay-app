import type { Language } from "@/lib/i18n";

/**
 * Canonical English `parameters.parameter_name` → localized display label.
 * Used as a reliable UI fallback when DB aliases are missing, stale, or raced.
 */
const PARAMETER_DISPLAY_LABELS: Record<Language, Record<string, string>> = {
  en: {
    Aluminum: "Aluminum",
    "Ammonium Nitrogen": "Ammonium Nitrogen",
    "Base Saturation": "Base Saturation",
    Boron: "Boron",
    "Bulk Density": "Bulk Density",
    Calcium: "Calcium",
    "Cation Exchange Capacity": "Cation Exchange Capacity",
    Clay: "Clay",
    Copper: "Copper",
    "Electrical Conductivity": "Electrical Conductivity",
    "Extractable Acidity": "Extractable Acidity",
    Iron: "Iron",
    Magnesium: "Magnesium",
    Manganese: "Manganese",
    "Nitrate Nitrogen": "Nitrate Nitrogen",
    Nitrogen: "Nitrogen",
    "Organic Matter": "Organic Matter",
    "pH KCl": "pH KCl",
    "pH Water": "pH Water",
    Phosphorus: "Phosphorus",
    Potassium: "Potassium",
    Sand: "Sand",
    Silt: "Silt",
    Sodium: "Sodium",
    "Soil Moisture": "Soil Moisture",
    Sulfur: "Sulfur",
    Zinc: "Zinc",
  },
  es: {
    Aluminum: "Aluminio",
    "Ammonium Nitrogen": "Nitrógeno amoniacal",
    "Base Saturation": "Saturación de bases",
    Boron: "Boro",
    "Bulk Density": "Densidad aparente",
    Calcium: "Calcio",
    "Cation Exchange Capacity": "Capacidad de intercambio catiónico",
    Clay: "Arcilla",
    Copper: "Cobre",
    "Electrical Conductivity": "Conductividad eléctrica",
    "Extractable Acidity": "Acidez extraíble",
    Iron: "Hierro",
    Magnesium: "Magnesio",
    Manganese: "Manganeso",
    "Nitrate Nitrogen": "Nitrógeno nítrico",
    Nitrogen: "Nitrógeno",
    "Organic Matter": "Materia orgánica",
    "pH KCl": "pH en KCl",
    "pH Water": "pH en agua",
    Phosphorus: "Fósforo",
    Potassium: "Potasio",
    Sand: "Arena",
    Silt: "Limo",
    Sodium: "Sodio",
    "Soil Moisture": "Humedad",
    Sulfur: "Azufre",
    Zinc: "Zinc",
  },
  fr: {
    Aluminum: "Aluminium",
    "Ammonium Nitrogen": "Azote ammoniacal",
    "Base Saturation": "Saturation en bases",
    Boron: "Bore",
    "Bulk Density": "Densité apparente",
    Calcium: "Calcium",
    "Cation Exchange Capacity": "Capacité d'échange cationique",
    Clay: "Argile",
    Copper: "Cuivre",
    "Electrical Conductivity": "Conductivité électrique",
    "Extractable Acidity": "Acidité extractible",
    Iron: "Fer",
    Magnesium: "Magnésium",
    Manganese: "Manganèse",
    "Nitrate Nitrogen": "Azote nitrique",
    Nitrogen: "Azote",
    "Organic Matter": "Matière organique",
    "pH KCl": "pH KCl",
    "pH Water": "pH eau",
    Phosphorus: "Phosphore",
    Potassium: "Potassium",
    Sand: "Sable",
    Silt: "Limon",
    Sodium: "Sodium",
    "Soil Moisture": "Humidité",
    Sulfur: "Soufre",
    Zinc: "Zinc",
  },
  ht: {
    Aluminum: "Aliminyòm",
    "Ammonium Nitrogen": "Nitwojèn amonyòm",
    "Base Saturation": "Satirasyon baz",
    Boron: "Bò",
    "Bulk Density": "Dansite aparan",
    Calcium: "Kalsyòm",
    "Cation Exchange Capacity": "Kapasite echanj kationik",
    Clay: "Ajil",
    Copper: "Kuiv",
    "Electrical Conductivity": "Kondiktivite elektrik",
    "Extractable Acidity": "Asidite ekstraktab",
    Iron: "Fè",
    Magnesium: "Mayezyòm",
    Manganese: "Manganèz",
    "Nitrate Nitrogen": "Nitwojèn nitrat",
    Nitrogen: "Azòt",
    "Organic Matter": "Matyè òganik",
    "pH KCl": "pH nan KCl",
    "pH Water": "pH nan dlo",
    Phosphorus: "Fosfò",
    Potassium: "Potasyòm",
    Sand: "Sab",
    Silt: "Limon",
    Sodium: "Sodyòm",
    "Soil Moisture": "Imidite",
    Sulfur: "Souf",
    Zinc: "Zenk",
  },
  pt: {
    Aluminum: "Alumínio",
    "Ammonium Nitrogen": "Nitrogênio amoniacal",
    "Base Saturation": "Saturação de bases",
    Boron: "Boro",
    "Bulk Density": "Densidade aparente",
    Calcium: "Cálcio",
    "Cation Exchange Capacity": "Capacidade de troca catiônica",
    Clay: "Argila",
    Copper: "Cobre",
    "Electrical Conductivity": "Condutividade elétrica",
    "Extractable Acidity": "Acidez extraível",
    Iron: "Ferro",
    Magnesium: "Magnésio",
    Manganese: "Manganês",
    "Nitrate Nitrogen": "Nitrogênio nítrico",
    Nitrogen: "Nitrogênio",
    "Organic Matter": "Matéria orgânica",
    "pH KCl": "pH em KCl",
    "pH Water": "pH em água",
    Phosphorus: "Fósforo",
    Potassium: "Potássio",
    Sand: "Areia",
    Silt: "Silte",
    Sodium: "Sódio",
    "Soil Moisture": "Umidade",
    Sulfur: "Enxofre",
    Zinc: "Zinco",
  },
  sw: {
    Aluminum: "Alumini",
    "Ammonium Nitrogen": "Nitrogeni amonia",
    "Base Saturation": "Kueneza kwa besi",
    Boron: "Boroni",
    "Bulk Density": "Msongamano wa wingi",
    Calcium: "Kalisi",
    "Cation Exchange Capacity": "Uwezo wa kubadilishana kationi",
    Clay: "Udongo wa mfinyanzi",
    Copper: "Shaba",
    "Electrical Conductivity": "Uendeshaji wa umeme",
    "Extractable Acidity": "Asidi inayoweza kutolewa",
    Iron: "Chuma",
    Magnesium: "Magnesi",
    Manganese: "Manganizi",
    "Nitrate Nitrogen": "Nitrogeni nitrati",
    Nitrogen: "Nitrogeni",
    "Organic Matter": "Mada hai",
    "pH KCl": "pH katika KCl",
    "pH Water": "pH katika maji",
    Phosphorus: "Fosforasi",
    Potassium: "Potasiamu",
    Sand: "Mchanga",
    Silt: "Uteo",
    Sodium: "Sodiamu",
    "Soil Moisture": "Unyevu wa udongo",
    Sulfur: "Salfa",
    Zinc: "Zinki",
  },
};

/** Reverse lookup: any known localized/alias label → canonical English name. */
const LABEL_TO_CANONICAL = (() => {
  const map = new Map<string, string>();
  for (const language of Object.keys(PARAMETER_DISPLAY_LABELS) as Language[]) {
    for (const [canonical, label] of Object.entries(
      PARAMETER_DISPLAY_LABELS[language]
    )) {
      map.set(canonical.toLowerCase(), canonical);
      map.set(label.toLowerCase(), canonical);
    }
  }
  // Common catalog / alias variants that should still resolve.
  const extras: Array<[string, string]> = [
    ["aluminium", "Aluminum"],
    ["sulphur", "Sulfur"],
    ["exchangeable acidity", "Extractable Acidity"],
    ["available p", "Phosphorus"],
    ["exchangeable k", "Potassium"],
    ["total n", "Nitrogen"],
    ["o.m.", "Organic Matter"],
    ["m.o.", "Organic Matter"],
    ["om", "Organic Matter"],
    ["mo", "Organic Matter"],
    ["cec", "Cation Exchange Capacity"],
    ["cic", "Cation Exchange Capacity"],
    ["ec", "Electrical Conductivity"],
    ["ce", "Electrical Conductivity"],
    ["ph in kcl", "pH KCl"],
    ["ph in water", "pH Water"],
    ["fosforo", "Phosphorus"],
    ["nitrogeno", "Nitrogen"],
  ];
  for (const [alias, canonical] of extras) {
    map.set(alias, canonical);
  }
  return map;
})();

function resolveCanonicalParameterName(
  parameterName?: string | null,
  displayName?: string | null
): string | null {
  for (const candidate of [parameterName, displayName]) {
    if (!candidate?.trim()) continue;
    const hit = LABEL_TO_CANONICAL.get(candidate.trim().toLowerCase());
    if (hit) return hit;
    // Exact catalog key (case-sensitive common form).
    if (PARAMETER_DISPLAY_LABELS.en[candidate.trim()]) {
      return candidate.trim();
    }
  }
  return null;
}

/** Localized display label for a lab parameter in the active app language. */
export function localizeParameterDisplayName(
  language: Language,
  parameterName?: string | null,
  displayName?: string | null
): string {
  const fallback = (displayName || parameterName || "").trim();
  const canonical = resolveCanonicalParameterName(parameterName, displayName);
  if (!canonical) return fallback;

  const table = PARAMETER_DISPLAY_LABELS[language] || PARAMETER_DISPLAY_LABELS.en;
  return table[canonical] || PARAMETER_DISPLAY_LABELS.en[canonical] || fallback;
}
