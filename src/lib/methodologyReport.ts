/**
 * Bilingual (ES/EN) methodology document for the Calculator module.
 * Documents formulas, steps and reference tables so results can be audited
 * and reproduced outside the app.
 *
 * Layout matches Cultosol PDF exports (brand header, section accent bars,
 * formula cards, bibliography).
 *
 * Primary source: "Tutoría Plan nutricional" (SUE302), Diego R. Villaseñor-Ortiz.
 * Tablas N.° 1–7 y Secciones 12–14 (enmiendas). Complementary formulas (SAR, PSI,
 * gypsum, leaching, DOP) follow USDA/FAO and foliar-diagnosis practice as
 * implemented in this app's calculators.
 */

import { saveBlobWithPicker } from "@/lib/fileSave";
import { pdfSafe } from "@/lib/pdfText";

type Bilingual = { es: string; en: string };

type MethodologyFormula = {
  label: string;
  formula: string;
  note?: Bilingual;
};

type MethodologySection = {
  id: string;
  number: number;
  title: Bilingual;
  intro: Bilingual;
  steps?: Bilingual[];
  formulas?: MethodologyFormula[];
  citation?: string;
};

type BibliographyEntry = {
  id: string;
  text: string;
};

const SOURCE_SUE302 =
  "Villaseñor-Ortiz, D. R. — Tutoría Plan nutricional (SUE302)";

const BIBLIOGRAPHY: BibliographyEntry[] = [
  {
    id: "sue302",
    text: "Villaseñor-Ortiz, D. R. Tutoría Plan nutricional (SUE302). Tablas N.° 1–7 y Secciones 12–14 (enmiendas). Material de tutoría / Soil fertility tutoring notes.",
  },
  {
    id: "vidal",
    text: "Vidal-Parra. Tabla N.° 7 — eficiencia de uso de nutrientes según sistema de riego (2008/2022). Referenced in SUE302 tutoring materials.",
  },
  {
    id: "fao29",
    text: "Ayers, R. S., & Westcot, D. W. Water quality for agriculture. FAO Irrigation and Drainage Paper 29. Food and Agriculture Organization of the United Nations.",
  },
  {
    id: "usda60",
    text: "United States Salinity Laboratory Staff. Diagnosis and Improvement of Saline and Alkali Soils. Agriculture Handbook No. 60. USDA.",
  },
  {
    id: "beaufils",
    text: "Beaufils, E. R. (1973). Diagnosis and Recommendation Integrated System (DRIS). University of Natal. Related foliar-balance methodology used alongside DOP interpretation in this app.",
  },
  {
    id: "usda-texture",
    text: "USDA Natural Resources Conservation Service. Soil texture triangle — particle-size class definitions (sand, silt, clay).",
  },
  {
    id: "cultosol",
    text: "Cultosol calculator module — implementation notes for CEC saturation bands, amendment gating, fertilizer formulation, and crop dose planning as shipped in the application.",
  },
];

const SECTIONS: MethodologySection[] = [
  {
    id: "diagnostico",
    number: 1,
    title: {
      es: "Diagnóstico nutricional del suelo",
      en: "Soil nutrient diagnosis",
    },
    intro: {
      es: "Cada parámetro de laboratorio (pH, acidez extraíble, K, Ca, Mg, Na, P, S, Fe, Cu, Zn, Mn) se clasifica como Bajo, Adecuado o Exceso comparándolo contra los rangos de referencia del método. Los rangos dependen del extractante: Olsen Modificado/KCl 1N o Mehlich III (Tabla N.° 1).",
      en: "Each lab parameter (pH, extractable acidity, K, Ca, Mg, Na, P, S, Fe, Cu, Zn, Mn) is classified as Low, Adequate or Excess against method reference ranges. Ranges depend on the extractant: Olsen Modified/KCl 1N or Mehlich III (Table No. 1).",
    },
    steps: [
      {
        es: "Seleccionar el método de extracción usado por el laboratorio (Olsen/KCl 1N o Mehlich III).",
        en: "Select the extraction method used by the lab (Olsen/KCl 1N or Mehlich III).",
      },
      {
        es: "Ubicar el valor reportado en las columnas Bajo / Adecuado / Alto del método correspondiente.",
        en: "Locate the reported value in the Low / Adequate / High columns of the matching method.",
      },
      {
        es: "Registrar la clasificación de cada nutriente como base del plan nutricional.",
        en: "Record each nutrient classification as the basis of the nutritional plan.",
      },
    ],
    formulas: [
      {
        label: "Clasificación",
        formula:
          "valor <= lowMax -> Bajo; lowMax < valor < highMin -> Adecuado; valor >= highMin -> Exceso",
        note: {
          es: "Cuando lowMax no aplica (p. ej. acidez extraíble en Olsen/KCl), el rango adecuado inicia en 0.",
          en: "When lowMax does not apply (e.g. extractable acidity under Olsen/KCl), the adequate range starts at 0.",
        },
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "cic",
    number: 2,
    title: {
      es: "CIC y saturación de bases",
      en: "CEC and base saturation",
    },
    intro: {
      es: "La Capacidad de Intercambio Catiónico (CIC o CICe) se reparte entre Ca, Mg, K, Na y acidez (H+Al). El porcentaje de saturación de cada catión se compara contra las bandas de la Tabla N.° 2.",
      en: "Cation Exchange Capacity (CEC or effective CEC) is distributed among Ca, Mg, K, Na and acidity (H+Al). Each cation saturation percentage is compared against Table No. 2 bands.",
    },
    formulas: [
      {
        label: "% Saturación catión",
        formula: "(cmol(+) cation / CIC) x 100",
      },
      {
        label: "Saturación total de bases (V%)",
        formula: "Ca% + Mg% + K% + Na%",
      },
      {
        label: "Meta V%",
        formula: "75-80%",
        note: {
          es: "Referencia adecuada para cultivos tropicales (Tabla N.° 2).",
          en: "Adequate reference for tropical crops (Table No. 2).",
        },
      },
      {
        label: "Relación C/N",
        formula: "C / N",
        note: {
          es: "Indicador de descomposición de materia orgánica / riesgo de inmovilización de N.",
          en: "Indicator of organic-matter decomposition / N immobilization risk.",
        },
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "ratios",
    number: 3,
    title: {
      es: "Relaciones catiónicas",
      en: "Cationic ratios",
    },
    intro: {
      es: "Las relaciones Ca/Mg, Ca/K y Mg/K predicen antagonismos de absorción (Tabla N.° 3). Se calculan como cociente de porcentajes de saturación. K/Na y Ca/Na usan la misma lógica de riesgo combinada con las bandas de Na%.",
      en: "Ca/Mg, Ca/K and Mg/K ratios predict uptake antagonism (Table No. 3). They are ratios of saturation percentages. K/Na and Ca/Na use the same risk logic combined with Na% bands.",
    },
    formulas: [
      {
        label: "Ca/Mg",
        formula: "Ca% / Mg%",
        note: { es: "Óptimo 3-5", en: "Optimal 3-5" },
      },
      {
        label: "Ca/K",
        formula: "Ca% / K%",
        note: { es: "Óptimo 9-25", en: "Optimal 9-25" },
      },
      {
        label: "Mg/K",
        formula: "Mg% / K%",
        note: { es: "Óptimo 2-7", en: "Optimal 2-7" },
      },
      {
        label: "K/Na",
        formula: "K% / Na%",
        note: { es: "Óptimo 1-15 (estimado)", en: "Optimal 1-15 (estimated)" },
      },
      {
        label: "Ca/Na",
        formula: "Ca% / Na%",
        note: { es: "Óptimo 9-25 (estimado)", en: "Optimal 9-25 (estimated)" },
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "conversion",
    number: 4,
    title: {
      es: "Conversión de unidades",
      en: "Unit conversion",
    },
    intro: {
      es: "Factores de la Tabla N.° 4 (elemento <-> óxido) y Tabla N.° 6 (cmol(+)/kg <-> mg/kg) para expresar bases y dosis en unidades de laboratorio y fertilizante.",
      en: "Table No. 4 factors (element <-> oxide) and Table No. 6 (cmol(+)/kg <-> mg/kg) express bases and doses in common lab and fertilizer units.",
    },
    formulas: [
      { label: "P -> P2O5", formula: "P x 2.29" },
      { label: "K -> K2O", formula: "K x 1.2" },
      { label: "Ca -> CaO", formula: "Ca x 1.4" },
      { label: "Mg -> MgO", formula: "Mg x 1.66" },
      {
        label: "cmol(+)/kg -> mg/kg",
        formula: "Ca x 200.4 · Mg x 121.5 · K x 391 · Na x 229.9",
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "encalado",
    number: 5,
    title: {
      es: "Requerimiento de encalado",
      en: "Liming requirement",
    },
    intro: {
      es: "Cuando la saturación de Ca está por debajo de la meta o el pH/acidez lo indican, se calcula el déficit de Ca, se convierte a CaO, se traduce a dosis del material (Sección 6) y se ajusta por PRNT/CCE del producto. Métodos alternativos (V%, acidez, pH objetivo, buffer) están disponibles en la calculadora de enmiendas.",
      en: "When Ca saturation is below target or pH/acidity indicate it, Ca deficit is converted to CaO, translated into a product dose (Section 6), and adjusted by product PRNT/CCE. Alternate methods (V%, acidity, target pH, buffer) are available in the amendment calculator.",
    },
    formulas: [
      { label: "Ca objetivo", formula: "CICe x (%Ca meta / 100)" },
      { label: "Déficit de Ca", formula: "Ca objetivo - Ca actual (cmol(+)/kg)" },
      { label: "CaO requerido", formula: "Ca requerido (kg/ha) x 1.40" },
      {
        label: "Dosis teórica",
        formula: "CaO requerido / (%CaO del material / 100)",
      },
      {
        label: "Dosis ajustada por PRNT",
        formula: "Dosis teórica / (PRNT / 100)",
      },
      {
        label: "Método V%",
        formula: "((V2 - V1) / 100) x CIC x 1.5 x (profundidad/10) x (DA/1.3)",
      },
      {
        label: "Método acidez",
        formula: "Acidez x 1.5 x factor profundidad/DA",
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "enmiendas",
    number: 6,
    title: {
      es: "Materiales de enmienda (Tabla N.° 12)",
      en: "Amendment materials (Table No. 12)",
    },
    intro: {
      es: "Secciones 12–14 del material de tutoría. La app elige cal, dolomita o yeso según la química de CICe/V%/Na (no solo el pH). La cal sube pH y Ca; la dolomita aporta Ca+Mg; el yeso aporta Ca sin subir mucho el pH (sodicidad o déficit de Ca sin necesidad de encalar).",
      en: "Tutoring sections 12–14. The app chooses lime, dolomite or gypsum from CICe/V%/Na chemistry (not pH alone). Lime raises pH and Ca; dolomite supplies Ca+Mg; gypsum supplies Ca without much pH rise (sodicity or Ca deficit without liming need).",
    },
    steps: [
      {
        es: "Cal agrícola si V% baja o Ca% bajo con acidez que justifica encalado.",
        en: "Agricultural lime when V% is low or Ca% is low with acidity that warrants liming.",
      },
      {
        es: "Dolomita si además Mg% está por debajo del rango adecuado.",
        en: "Dolomite when Mg% is also below the adequate range.",
      },
      {
        es: "Yeso si Na% alto (sodicidad) o déficit de Ca sin necesidad de encalar.",
        en: "Gypsum when Na% is high (sodicity) or Ca is deficient without a liming need.",
      },
    ],
    formulas: [
      {
        label: "Cal agrícola",
        formula: "40% CaO · 0% MgO · ajustar por PRNT/CCE",
      },
      {
        label: "Dolomita",
        formula: "30% CaO · 14% MgO · ajustar por PRNT/CCE",
      },
      {
        label: "Yeso (CaSO4)",
        formula: "14% CaO · 0% MgO · sin ajuste PRNT",
      },
      {
        label: "Dosis producto",
        formula: "Demanda CaO / (%CaO/100) [/ (PRNT/100) solo cal/dolomita]",
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "dosis",
    number: 7,
    title: {
      es: "Plan de fertilización y dosis por cultivo",
      en: "Fertilizer plan and crop doses",
    },
    intro: {
      es: "La demanda se calcula con el rendimiento objetivo y el coeficiente de extracción (Tabla N.° 5, ~28 cultivos). El suministro del suelo usa nutriente disponible, profundidad y densidad aparente. La dosis final descuenta suministro y ajusta por eficiencia de uso.",
      en: "Demand uses target yield and crop extraction coefficients (Table No. 5, ~28 crops). Soil supply uses available nutrient, depth and bulk density. Final dose subtracts supply and adjusts for use efficiency.",
    },
    formulas: [
      {
        label: "Demanda nutriente",
        formula: "Rendimiento objetivo (t/ha) x coeficiente de extracción (kg/t)",
      },
      {
        label: "Suministro del suelo",
        formula: "kg/ha = mg/kg x DA (g/cm3) x profundidad (cm) x 0.1",
      },
      {
        label: "Dosis final",
        formula: "(Demanda - Suministro) / Eficiencia de uso",
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "om-n",
    number: 8,
    title: {
      es: "N mineralizable desde materia orgánica",
      en: "Mineralizable N from organic matter",
    },
    intro: {
      es: "SUE302 §2.5.1. Se asume que la MO contiene ~5% de N orgánico; una fracción se mineraliza en la temporada según el escenario climático/actividad biológica.",
      en: "SUE302 §2.5.1. OM is assumed ~5% organic N; a seasonal fraction mineralizes according to the climate / biological-activity scenario.",
    },
    formulas: [
      { label: "N orgánico %", formula: "MO% x 0.05" },
      {
        label: "N mineralizable %",
        formula: "N orgánico% x coeficiente de mineralización",
      },
      { label: "mg/kg", formula: "N mineralizable% x 10 000" },
      {
        label: "kg/ha",
        formula: "mg/kg x (masa de suelo t/ha / 1000)",
      },
      {
        label: "Coeficientes",
        formula: "Conservador 1-2% · Templado 2-3% · Tropical 3-5%",
        note: {
          es: "El usuario puede fijar un coeficiente personalizado.",
          en: "The user may set a custom coefficient.",
        },
      },
    ],
    citation: SOURCE_SUE302,
  },
  {
    id: "riego",
    number: 9,
    title: {
      es: "Eficiencia de uso por sistema de riego",
      en: "Nutrient-use efficiency by irrigation system",
    },
    intro: {
      es: "Tabla N.° 7 (Vidal-Parra): rangos de eficiencia (%) de N, P, K y Mg para surco/inundación, aspersión/pivote y goteo/microaspersión. El punto medio autocompleta el plan; el usuario puede sobrescribirlo.",
      en: "Table No. 7 (Vidal-Parra): N, P, K and Mg efficiency ranges (%) for furrow/flood, sprinkler/pivot and drip/micro-sprinkler. The midpoint auto-fills the plan; the user may override it.",
    },
    formulas: [
      {
        label: "Eficiencia aplicada",
        formula: "(min% + max%) / 2 (1 decimal)",
      },
    ],
    citation: "Vidal-Parra (2008/2022) via SUE302 Tabla N.° 7",
  },
  {
    id: "salinidad",
    number: 10,
    title: {
      es: "Salinidad, sodicidad y lixiviación",
      en: "Salinity, sodicity and leaching",
    },
    intro: {
      es: "PSI/ESP y SAR diagnostican sodicidad. El yeso corrige exceso de sodio; el requerimiento de lixiviación (RL) estima agua adicional para controlar salinidad con el agua de riego disponible.",
      en: "ESP/PSI and SAR diagnose sodicity. Gypsum corrects excess sodium; leaching requirement (LR) estimates extra water to control salinity with available irrigation water.",
    },
    formulas: [
      { label: "SAR", formula: "Na / sqrt((Ca + Mg) / 2)" },
      { label: "PSI (ESP)", formula: "(Na intercambiable / CIC) x 100" },
      {
        label: "Yeso (meq/100g)",
        formula: "CICe x ((PSI actual - PSI meta) / 100)",
      },
      {
        label: "Yeso (mg/100g)",
        formula: "[CICe x ((PSI actual - PSI meta)/100)] x 87",
      },
      {
        label: "Requerimiento de lixiviación (RL)",
        formula: "ECw / (5 x ECe meta - ECw) x 100",
      },
      { label: "Agua total", formula: "ET / (1 - RL)" },
      {
        label: "Porosidad",
        formula: "(1 - densidad aparente / densidad de partícula) x 100",
      },
    ],
    citation: "Ayers & Westcot (FAO 29) · USDA Handbook 60",
  },
  {
    id: "dop",
    number: 11,
    title: {
      es: "Desviación del Óptimo Porcentual (DOP)",
      en: "Deviation from Optimum Percentage (DOP)",
    },
    intro: {
      es: "Compara el valor foliar de cada nutriente contra su óptimo (punto medio del rango de suficiencia, o valor de referencia). DOP negativo = deficiencia; positivo = exceso relativo.",
      en: "Compares each foliar nutrient value against its optimum (sufficiency-range midpoint, or a reference value). Negative DOP = deficiency; positive = relative excess.",
    },
    formulas: [
      { label: "DOP", formula: "((valor - óptimo) / óptimo) x 100" },
    ],
    citation: "Beaufils (1973) — DRIS / related foliar-balance practice",
  },
  {
    id: "absorcion",
    number: 12,
    title: {
      es: "Curvas de absorción de nutrientes",
      en: "Nutrient uptake curves",
    },
    intro: {
      es: "Muestran el ritmo relativo (%) de captación por etapa fenológica. Son indicativas: ajústelas con etapa real, clima, riego, cultivar y recomendaciones locales. No sustituyen el análisis de suelo o foliar.",
      en: "Show relative uptake (%) by phenological stage. Indicative only: adjust with actual stage, weather, irrigation, cultivar and local advice. They do not replace soil or foliar analysis.",
    },
    citation: "Generalized crop nutrient-uptake profiles (indicative)",
  },
  {
    id: "textura",
    number: 13,
    title: {
      es: "Clase textural del suelo",
      en: "Soil texture class",
    },
    intro: {
      es: "A partir de % arena, limo y arcilla (suma ≈ 100%) se asigna la clase USDA (arcilla, franco, franco arenoso, etc.). La textura informa factores de encalado/acidificación y aparece en el reporte PDF.",
      en: "From % sand, silt and clay (sum ≈ 100%) the USDA class is assigned (clay, loam, sandy loam, etc.). Texture informs lime/acidification factors and appears in the PDF report.",
    },
    formulas: [
      {
        label: "Validación",
        formula: "arena + limo + arcilla ≈ 100% (tolerancia 98-102%)",
      },
      {
        label: "Clasificación",
        formula: "Reglas del triángulo textural USDA",
      },
    ],
    citation: "USDA soil texture triangle",
  },
  {
    id: "formulacion",
    number: 14,
    title: {
      es: "Formulación de fertilizantes (mezcla)",
      en: "Fertilizer formulation (blending)",
    },
    intro: {
      es: "Calcula una receta N-P2O5-K2O a partir de materias primas del catálogo. Puede completar el lote con relleno inerte o escalar productos al peso de lote. La estrategia «mejor mezcla» prioriza pocas fuentes que cumplan el grado.",
      en: "Builds an N-P2O5-K2O recipe from catalog raw materials. May finish the batch with inert filler or scale products to batch mass. The «best mix» strategy prefers few sources that hit the grade.",
    },
    formulas: [
      {
        label: "Nutriente requerido",
        formula: "(% grado objetivo / 100) x masa de lote",
      },
      {
        label: "Aporte de producto",
        formula: "masa producto x (% nutriente / 100)",
      },
      {
        label: "Relleno (opcional)",
        formula: "masa lote - suma masas de productos activos",
      },
    ],
    citation: "Cultosol fertilizer formulation module",
  },
  {
    id: "alcance",
    number: 15,
    title: {
      es: "Alcance y limitaciones",
      en: "Scope and limitations",
    },
    intro: {
      es: "Cultosol apoya el diagnóstico y la planificación; no sustituye el criterio agronómico local ni un muestreo representativo. Los rangos y coeficientes son referencias: verifique extractante de laboratorio, cultivar, clima y regulación local antes de aplicar dosis.",
      en: "Cultosol supports diagnosis and planning; it does not replace local agronomic judgment or representative sampling. Ranges and coefficients are references: verify lab extractant, cultivar, climate and local rules before applying doses.",
    },
    steps: [
      {
        es: "Use el mismo método de extracción que reportó el laboratorio.",
        en: "Use the same extraction method the lab reported.",
      },
      {
        es: "Confirme densidades, profundidades y eficiencias con datos de campo.",
        en: "Confirm bulk densities, depths and efficiencies with field data.",
      },
      {
        es: "Las curvas de absorción y tipologías de riego son orientativas.",
        en: "Uptake curves and irrigation typologies are indicative.",
      },
    ],
  },
];

export async function exportMethodologyPdf(
  fileName = "cultosol-metodologia-calculadora.pdf"
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const BRAND: [number, number, number] = [5, 150, 105];
  const BRAND_DARK: [number, number, number] = [4, 120, 87];
  const INK: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [100, 116, 139];
  const LINE: [number, number, number] = [226, 232, 240];
  const CARD: [number, number, number] = [248, 250, 252];
  const HEAD_BG: [number, number, number] = [236, 253, 245];
  const WHITE: [number, number, number] = [255, 255, 255];

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      pdfSafe("Cultosol · Metodología / Methodology"),
      margin,
      pageHeight - 7
    );
    pdf.text(String(pageNumber), pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  function newPage() {
    drawFooter();
    pdf.addPage();
    pageNumber += 1;
    y = margin;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 18) newPage();
  }

  function spaceAfter(mm = 4) {
    y += mm;
  }

  function drawParagraph(
    text: string,
    size = 9.5,
    options: {
      bold?: boolean;
      color?: [number, number, number];
      indent?: number;
    } = {}
  ) {
    const safe = pdfSafe(text);
    if (!safe) return;
    const indent = options.indent ?? 0;
    const width = contentWidth - indent;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const color = options.color || INK;
    pdf.setTextColor(color[0], color[1], color[2]);
    const lines = pdf.splitTextToSize(safe, width);
    const lineH = size * 0.42 + 2.1;
    for (const line of lines) {
      ensureSpace(lineH + 1);
      pdf.text(line, margin + indent, y);
      y += lineH;
    }
  }

  function drawBilingualBlock(block: Bilingual, size = 9.5) {
    drawParagraph(block.es, size, { color: INK });
    spaceAfter(1.5);
    drawParagraph(block.en, size - 0.5, { color: MUTED });
    spaceAfter(3);
  }

  function drawSectionTitle(number: number, title: Bilingual) {
    ensureSpace(22);
    spaceAfter(3);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.4, 10, 0.6, 0.6, "F");

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    const esTitle = pdfSafe(`${number}. ${title.es}`);
    const esLines = pdf.splitTextToSize(esTitle, contentWidth - 8);
    let titleY = y + 4.5;
    for (const line of esLines) {
      pdf.text(line, margin + 5.5, titleY);
      titleY += 5;
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const enTitle = pdfSafe(title.en);
    const enLines = pdf.splitTextToSize(enTitle, contentWidth - 8);
    for (const line of enLines) {
      pdf.text(line, margin + 5.5, titleY);
      titleY += 4;
    }
    y = titleY + 3;
  }

  function drawContentsHeading() {
    ensureSpace(18);
    spaceAfter(2);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.4, 10, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(pdfSafe("Contenido"), margin + 5.5, y + 4.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(pdfSafe("Contents"), margin + 5.5, y + 9);
    y += 14;
  }

  function drawSubsectionLabel(es: string, en: string) {
    ensureSpace(10);
    spaceAfter(1);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(pdfSafe(`${es} / ${en}`), margin, y);
    y += 5;
  }

  function drawFormulaCard(f: MethodologyFormula) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const label = pdfSafe(f.label);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(8.5);
    const formulaLines = pdf.splitTextToSize(
      pdfSafe(f.formula),
      contentWidth - 10
    );
    let noteLinesEs: string[] = [];
    let noteLinesEn: string[] = [];
    if (f.note) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      noteLinesEs = pdf.splitTextToSize(pdfSafe(f.note.es), contentWidth - 10);
      noteLinesEn = pdf.splitTextToSize(pdfSafe(f.note.en), contentWidth - 10);
    }

    const cardH =
      5 +
      4.5 +
      formulaLines.length * 4 +
      (f.note ? 2 + noteLinesEs.length * 3.4 + noteLinesEn.length * 3.4 : 0) +
      3;

    ensureSpace(cardH + 2);
    pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
    pdf.roundedRect(margin, y, contentWidth, cardH, 1.5, 1.5, "F");

    let textY = y + 5;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(label, margin + 3.5, textY);
    textY += 5;

    pdf.setFont("courier", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    for (const line of formulaLines) {
      pdf.text(line, margin + 3.5, textY);
      textY += 4;
    }

    if (f.note) {
      textY += 1.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      for (const line of noteLinesEs) {
        pdf.text(line, margin + 3.5, textY);
        textY += 3.4;
      }
      for (const line of noteLinesEn) {
        pdf.text(line, margin + 3.5, textY);
        textY += 3.4;
      }
    }

    y += cardH + 2.5;
  }

  function drawStep(index: number, step: Bilingual) {
    ensureSpace(14);
    const bullet = `${index}.`;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(bullet, margin, y);

    const indent = 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const esLines = pdf.splitTextToSize(
      pdfSafe(step.es),
      contentWidth - indent
    );
    let textY = y;
    for (const line of esLines) {
      ensureSpace(5);
      pdf.text(line, margin + indent, textY);
      textY += 4.2;
    }
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const enLines = pdf.splitTextToSize(
      pdfSafe(step.en),
      contentWidth - indent
    );
    for (const line of enLines) {
      ensureSpace(5);
      pdf.text(line, margin + indent, textY);
      textY += 3.8;
    }
    y = textY + 2.5;
  }

  // —— Cover header ——
  const headerH = 36;
  pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.rect(0, 0, pageWidth, headerH, "F");
  pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(pdfSafe("Cultosol"), margin, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(220, 252, 231);
  pdf.text(
    pdfSafe("Metodología de la Calculadora / Calculator Methodology"),
    margin,
    24
  );
  pdf.setFontSize(8.5);
  pdf.text(
    pdfSafe(`Generado / Generated: ${new Date().toLocaleDateString()}`),
    pageWidth - margin,
    24,
    { align: "right" }
  );
  y = headerH + 10;

  // —— Intro card ——
  const introEs =
    "Este documento describe, en español e inglés, las fórmulas, pasos y tablas de referencia del módulo de calculadora, para auditar y reproducir resultados fuera de la app.";
  const introEn =
    "This document describes, in Spanish and English, the formulas, steps and reference tables of the calculator module, so results can be audited and reproduced outside the app.";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const introEsLines = pdf.splitTextToSize(pdfSafe(introEs), contentWidth - 10);
  pdf.setFontSize(9);
  const introEnLines = pdf.splitTextToSize(pdfSafe(introEn), contentWidth - 10);
  const introH =
    8 + introEsLines.length * 4.4 + 2 + introEnLines.length * 4 + 6;
  ensureSpace(introH + 4);
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, y, contentWidth, introH, 2, 2, "FD");
  let introY = y + 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  for (const line of introEsLines) {
    pdf.text(line, margin + 4, introY);
    introY += 4.4;
  }
  introY += 1.5;
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  for (const line of introEnLines) {
    pdf.text(line, margin + 4, introY);
    introY += 4;
  }
  y += introH + 8;

  // —— Table of contents ——
  drawContentsHeading();
  for (const section of SECTIONS) {
    ensureSpace(7);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(pdfSafe(`${section.number}.`), margin, y);
    pdf.setFont("helvetica", "normal");
    const tocLine = pdfSafe(`${section.title.es} / ${section.title.en}`);
    const tocLines = pdf.splitTextToSize(tocLine, contentWidth - 12);
    let tocY = y;
    for (const line of tocLines) {
      pdf.text(line, margin + 8, tocY);
      tocY += 4;
    }
    y = tocY + 1.5;
  }
  ensureSpace(7);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(pdfSafe(`${SECTIONS.length + 1}.`), margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(pdfSafe("Bibliografía / Bibliography"), margin + 8, y);
  y += 8;

  // —— Body sections ——
  for (const section of SECTIONS) {
    drawSectionTitle(section.number, section.title);
    drawBilingualBlock(section.intro, 9.5);

    if (section.steps?.length) {
      drawSubsectionLabel("Pasos", "Steps");
      section.steps.forEach((step, i) => drawStep(i + 1, step));
      spaceAfter(2);
    }

    if (section.formulas?.length) {
      drawSubsectionLabel("Fórmulas", "Formulas");
      for (const formula of section.formulas) {
        drawFormulaCard(formula);
      }
      spaceAfter(1);
    }

    if (section.citation) {
      ensureSpace(8);
      pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
      const cite = pdfSafe(`Fuente / Source: ${section.citation}`);
      const citeLines = pdf.splitTextToSize(cite, contentWidth - 8);
      const citeH = citeLines.length * 3.6 + 5;
      pdf.roundedRect(margin, y, contentWidth, citeH, 1.2, 1.2, "F");
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7.5);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      let citeY = y + 4;
      for (const line of citeLines) {
        pdf.text(line, margin + 3, citeY);
        citeY += 3.6;
      }
      y += citeH + 4;
    }
  }

  // —— Bibliography ——
  drawSectionTitle(SECTIONS.length + 1, {
    es: "Bibliografía",
    en: "Bibliography",
  });
  drawParagraph(
    "Referencias utilizadas por el módulo de calculadora y este documento. / References used by the calculator module and this document.",
    9,
    { color: MUTED }
  );
  spaceAfter(3);

  BIBLIOGRAPHY.forEach((entry, index) => {
    const marker = `[${index + 1}]`;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(pdfSafe(entry.text), contentWidth - 12);
    const blockH = Math.max(6, lines.length * 4.2 + 2);
    ensureSpace(blockH + 2);

    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(marker, margin, y + 3.5);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    let bibY = y + 3.5;
    for (const line of lines) {
      pdf.text(line, margin + 10, bibY);
      bibY += 4.2;
    }
    y = bibY + 3;
  });

  drawFooter();

  const pdfBlob = new Blob([pdf.output("arraybuffer")], {
    type: "application/pdf",
  });
  await saveBlobWithPicker(
    pdfBlob,
    fileName,
    "application/pdf",
    ".pdf",
    () => pdf.save(fileName)
  );
}
