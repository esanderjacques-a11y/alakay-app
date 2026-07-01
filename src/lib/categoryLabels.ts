import type { Language, Translation } from "@/lib/translations";

type TextTranslationKey = {
  [Key in keyof Translation]: Translation[Key] extends string ? Key : never;
}[keyof Translation];

const CATEGORY_MAP: Record<string, TextTranslationKey> = {
  All: "all",
  Other: "categoryOther",
  Custom: "categoryCustom",
  Chemical: "categoryChemical",
  Macronutrient: "categoryMacronutrient",
  Micronutrient: "categoryMicronutrient",
  "Nitrogen Form": "categoryNitrogenForm",
  "Physical Properties": "categoryPhysicalProperties",
  Physical: "categoryPhysicalProperties",
  "Physical properties": "categoryPhysicalProperties",
  "Physical Property": "categoryPhysicalProperty",
  "Soil Property": "categorySoilProperty",
  Texture: "categoryTexture",
  "Toxic Element": "categoryToxicElement",
  Acidity: "categoryAcidity",
  Salinity: "categorySalinity",
  "Base Saturation": "categoryBaseSaturation",
  Ratios: "categoryRatios",
  Biological: "categoryBiological",
};

const COMPACT_CATEGORY_KEY: Partial<Record<TextTranslationKey, TextTranslationKey>> = {
  categoryPhysicalProperties: "categoryPhysicalShort",
};

export function translateCategory(
  category: string,
  language: Language,
  translations: Record<Language, Translation>,
  options?: { compact?: boolean }
): string {
  const key = CATEGORY_MAP[category];
  if (key) {
    const compactKey =
      options?.compact && COMPACT_CATEGORY_KEY[key]
        ? COMPACT_CATEGORY_KEY[key]
        : key;
    return translations[language][compactKey];
  }
  return category;
}
