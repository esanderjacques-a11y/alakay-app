import type { Language } from "@/lib/i18n";

/** Display names for catalog fertilizers (key → localized label). */
const PRODUCT_LABELS: Record<Language, Record<string, string>> = {
  en: {
    urea: "Urea",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Ammonium nitrate",
    calcium_nitrate: "Calcium nitrate",
    nitrato_de_calcio: "Calcium nitrate",
    gypsum: "Gypsum",
    agricultural_lime: "Agricultural lime",
    ammonium_sulfate: "Ammonium sulfate",
    tsp: "Triple superphosphate (TSP)",
    mop: "Muriate of potash (MOP/KCl)",
    sop: "Sulfate of potash (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kieserite",
    magnesium_sulfate: "Magnesium sulfate",
    zinc_sulfate: "Zinc sulfate",
    borax: "Borax",
    solubor: "Solubor",
    ferrous_sulfate: "Ferrous sulfate",
    manganese_sulfate: "Manganese sulfate",
    copper_sulfate: "Copper sulfate",
    sodium_molybdate: "Sodium molybdate",
  },
  es: {
    urea: "Urea",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Nitrato de amonio",
    calcium_nitrate: "Nitrato de calcio",
    nitrato_de_calcio: "Nitrato de calcio",
    gypsum: "Yeso agrícola",
    agricultural_lime: "Cal agrícola",
    ammonium_sulfate: "Sulfato de amonio",
    tsp: "Superfosfato triple (TSP)",
    mop: "Muriato de potasio (MOP/KCl)",
    sop: "Sulfato de potasio (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kieserita",
    magnesium_sulfate: "Sulfato de magnesio",
    zinc_sulfate: "Sulfato de zinc",
    borax: "Bórax",
    solubor: "Solubor",
    ferrous_sulfate: "Sulfato ferroso",
    manganese_sulfate: "Sulfato de manganeso",
    copper_sulfate: "Sulfato de cobre",
    sodium_molybdate: "Molibdato de sodio",
  },
  fr: {
    urea: "Urée",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Nitrate d'ammonium",
    calcium_nitrate: "Nitrate de calcium",
    nitrato_de_calcio: "Nitrate de calcium",
    gypsum: "Gypse",
    agricultural_lime: "Chaux agricole",
    ammonium_sulfate: "Sulfate d'ammonium",
    tsp: "Superphosphate triple (TSP)",
    mop: "Muriate de potasse (MOP/KCl)",
    sop: "Sulfate de potasse (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kiesérite",
    magnesium_sulfate: "Sulfate de magnésium",
    zinc_sulfate: "Sulfate de zinc",
    borax: "Borax",
    solubor: "Solubor",
    ferrous_sulfate: "Sulfate ferreux",
    manganese_sulfate: "Sulfate de manganèse",
    copper_sulfate: "Sulfate de cuivre",
    sodium_molybdate: "Molybdate de sodium",
  },
  ht: {
    urea: "Ure",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Nitrat amonyòm",
    calcium_nitrate: "Nitrat kalsyòm",
    nitrato_de_calcio: "Nitrat kalsyòm",
    gypsum: "Jips",
    agricultural_lime: "Lacho agrikòl",
    ammonium_sulfate: "Silfat amonyòm",
    tsp: "Sipèfosfat trip (TSP)",
    mop: "Miryat potasyòm (MOP/KCl)",
    sop: "Silfat potasyòm (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kieserit",
    magnesium_sulfate: "Silfat mayezyòm",
    zinc_sulfate: "Silfat zenk",
    borax: "Boraks",
    solubor: "Solubor",
    ferrous_sulfate: "Silfat ferè",
    manganese_sulfate: "Silfat mangannèz",
    copper_sulfate: "Silfat kwiv",
    sodium_molybdate: "Molibdat sodyòm",
  },
  pt: {
    urea: "Ureia",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Nitrato de amônio",
    calcium_nitrate: "Nitrato de cálcio",
    nitrato_de_calcio: "Nitrato de cálcio",
    gypsum: "Gesso agrícola",
    agricultural_lime: "Calcário agrícola",
    ammonium_sulfate: "Sulfato de amônio",
    tsp: "Superfosfato triplo (TSP)",
    mop: "Cloreto de potássio (MOP/KCl)",
    sop: "Sulfato de potássio (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kieserita",
    magnesium_sulfate: "Sulfato de magnésio",
    zinc_sulfate: "Sulfato de zinco",
    borax: "Bórax",
    solubor: "Solubor",
    ferrous_sulfate: "Sulfato ferroso",
    manganese_sulfate: "Sulfato de manganês",
    copper_sulfate: "Sulfato de cobre",
    sodium_molybdate: "Molibdato de sódio",
  },
  sw: {
    urea: "Urea",
    dap: "DAP",
    map: "MAP",
    ammonium_nitrate: "Nitrati ya amonia",
    calcium_nitrate: "Nitrati ya kalsiamu",
    nitrato_de_calcio: "Nitrati ya kalsiamu",
    gypsum: "Jasi",
    agricultural_lime: "Chokaa cha kilimo",
    ammonium_sulfate: "Salaiti ya amonia",
    tsp: "Superphosphate tatu (TSP)",
    mop: "Muriate ya potashi (MOP/KCl)",
    sop: "Salaiti ya potashi (SOP)",
    npk_15_15_15: "NPK 15-15-15",
    npk_10_30_10: "NPK 10-30-10",
    kieserite: "Kieserite",
    magnesium_sulfate: "Salaiti ya magnesiamu",
    zinc_sulfate: "Salaiti ya zinki",
    borax: "Borax",
    solubor: "Solubor",
    ferrous_sulfate: "Salaiti ya chuma",
    manganese_sulfate: "Salaiti ya manganese",
    copper_sulfate: "Salaiti ya shaba",
    sodium_molybdate: "Molibdeti ya sodiamu",
  },
};

const FILLER_LABELS: Record<Language, Record<string, string>> = {
  en: {
    silica_sand: "Silica sand",
    bentonite: "Bentonite clay",
    vermiculite: "Vermiculite",
    diatomaceous_earth: "Diatomaceous earth",
    rice_husk: "Rice husk",
  },
  es: {
    silica_sand: "Arena de sílice",
    bentonite: "Arcilla bentonita",
    vermiculite: "Vermiculita",
    diatomaceous_earth: "Tierra de diatomeas",
    rice_husk: "Cascarilla de arroz",
  },
  fr: {
    silica_sand: "Sable de silice",
    bentonite: "Argile bentonite",
    vermiculite: "Vermiculite",
    diatomaceous_earth: "Terre de diatomées",
    rice_husk: "Balle de riz",
  },
  ht: {
    silica_sand: "Sab silis",
    bentonite: "Ajil bentonit",
    vermiculite: "Vèmikilit",
    diatomaceous_earth: "Tè dyatom",
    rice_husk: "Po diri",
  },
  pt: {
    silica_sand: "Areia de sílica",
    bentonite: "Argila bentonita",
    vermiculite: "Vermiculita",
    diatomaceous_earth: "Terra de diatomáceas",
    rice_husk: "Casca de arroz",
  },
  sw: {
    silica_sand: "Mchanga wa silica",
    bentonite: "Udongo wa bentonite",
    vermiculite: "Vermiculite",
    diatomaceous_earth: "Udongo wa diatomite",
    rice_husk: "Maganda ya mchele",
  },
};

export function localizedFertilizerLabel(
  key: string,
  language: Language,
  fallback?: string | null
) {
  return (
    PRODUCT_LABELS[language]?.[key] ||
    PRODUCT_LABELS.en[key] ||
    fallback ||
    key
  );
}

export function localizedFillerLabel(
  key: string,
  language: Language,
  fallback?: string | null
) {
  return (
    FILLER_LABELS[language]?.[key] ||
    FILLER_LABELS.en[key] ||
    fallback ||
    key
  );
}

/** Include EN + active language names so search still finds products. */
export function fertilizerSearchHaystack(
  key: string,
  analysis: string,
  language: Language,
  fallbackLabel: string
) {
  const local = localizedFertilizerLabel(key, language, fallbackLabel);
  const english = localizedFertilizerLabel(key, "en", fallbackLabel);
  return `${local} ${english} ${analysis} ${key}`.toLowerCase();
}
