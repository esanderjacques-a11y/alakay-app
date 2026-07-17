/**
 * Bilingual (ES/EN) methodology document for the Calculator module.
 * Documents every formula, step and reference table used by the calculators so
 * results can be audited and reproduced outside the app.
 *
 * Primary source: "Tutoría Plan nutricional" (SUE302), Diego R. Villaseñor-Ortiz.
 * Tablas N.° 1–7 y Secciones 12–14 (enmiendas). Complementary formulas (SAR, PSI,
 * gypsum, leaching, DOP) follow standard USDA/FAO soil-salinity and plant-tissue
 * diagnosis methodology as implemented in this app's calculators.
 */

import { saveBlobWithPicker } from "@/lib/fileSave";

export type MethodologyLocale = "es" | "en";

type Bilingual = { es: string; en: string };

type MethodologyFormula = {
  label: string;
  formula: string;
  note?: Bilingual;
};

type MethodologySection = {
  id: string;
  title: Bilingual;
  intro: Bilingual;
  steps?: Bilingual[];
  formulas?: MethodologyFormula[];
  citation: string;
};

const SOURCE_CITATION =
  "Villaseñor-Ortiz, D. R. — Tutoría Plan nutricional (SUE302)";

const SECTIONS: MethodologySection[] = [
  {
    id: "diagnostico",
    title: { es: "1. Diagnóstico nutricional del suelo", en: "1. Soil nutrient diagnosis" },
    intro: {
      es: "Cada parámetro de laboratorio (pH, acidez extraíble, K, Ca, Mg, Na, P, S, Fe, Cu, Zn, Mn) se clasifica como Bajo, Adecuado o Exceso comparándolo contra los rangos de referencia del método. Los rangos dependen del método de extracción del laboratorio: Olsen Modificado/KCl 1N o Mehlich III, ya que ambos métodos reportan concentraciones distintas para el mismo suelo.",
      en: "Each lab parameter (pH, extractable acidity, K, Ca, Mg, Na, P, S, Fe, Cu, Zn, Mn) is classified as Low, Adequate or Excess by comparing it against the method reference ranges. Ranges depend on the lab's extraction method: Olsen Modified/KCl 1N or Mehlich III, since each method reports different concentrations for the same soil.",
    },
    steps: [
      {
        es: "1. Seleccionar el método de extracción usado por el laboratorio (Olsen/KCl 1N o Mehlich III).",
        en: "1. Select the extraction method used by the lab (Olsen/KCl 1N or Mehlich III).",
      },
      {
        es: "2. Ubicar el valor reportado dentro de las columnas Bajo / Adecuado / Alto del método correspondiente.",
        en: "2. Locate the reported value within the Low / Adequate / High columns of the matching extraction method.",
      },
      {
        es: "3. Registrar la clasificación de cada nutriente como base del plan nutricional.",
        en: "3. Record each nutrient's classification as the basis of the nutritional plan.",
      },
    ],
    formulas: [
      {
        label: "Clasificación",
        formula: "valor ≤ lowMax → Bajo · lowMax < valor < highMin → Adecuado · valor ≥ highMin → Exceso",
        note: {
          es: "Cuando lowMax no aplica (p. ej. acidez extraíble en Olsen/KCl), el rango adecuado inicia en 0.",
          en: "When lowMax does not apply (e.g. extractable acidity under Olsen/KCl), the adequate range starts at 0.",
        },
      },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "cic",
    title: { es: "2. CIC y saturación de bases", en: "2. CEC and base saturation" },
    intro: {
      es: "La Capacidad de Intercambio Catiónico (CIC o CICe) se reparte entre Ca, Mg, K, Na y acidez (H+Al). El porcentaje de saturación de cada catión se compara contra las bandas de saturación de referencia para diagnosticar excesos o deficiencias relativas.",
      en: "Cation Exchange Capacity (CEC or effective CEC) is distributed among Ca, Mg, K, Na and acidity (H+Al). Each cation's saturation percentage is compared against the reference saturation bands to diagnose relative excess or deficiency.",
    },
    formulas: [
      { label: "% Saturación catión", formula: "(cmol(+) catión / CIC) × 100" },
      { label: "Saturación total de bases (V%)", formula: "Ca% + Mg% + K% + Na%" },
      {
        label: "Meta V%",
        formula: "75–80%",
        note: { es: "Adecuado para cultivos tropicales (referencia para cultivos tropicales).", en: "Adequate for tropical crops (tropical crops reference)." },
      },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "ratios",
    title: { es: "3. Relaciones catiónicas", en: "3. Cationic ratios" },
    intro: {
      es: "Las relaciones entre cationes (Ca/Mg, Ca/K, Mg/K) predicen antagonismos de absorción. Se calculan como cociente de los porcentajes de saturación y se comparan contra los rangos óptimos de referencia. Las relaciones K/Na y Ca/Na se estiman con la misma lógica de riesgo que Ca/K combinada con las bandas de Na%.",
      en: "Cation ratios (Ca/Mg, Ca/K, Mg/K) predict uptake antagonism. They are computed as the ratio of saturation percentages and compared against the optimal reference ranges. K/Na and Ca/Na ratios are estimated using the same risk logic as Ca/K combined with Na% bands.",
    },
    formulas: [
      { label: "Ca/Mg", formula: "Ca% / Mg%", note: { es: "Óptimo 3–5", en: "Optimal 3–5" } },
      { label: "Ca/K", formula: "Ca% / K%", note: { es: "Óptimo 9–25", en: "Optimal 9–25" } },
      { label: "Mg/K", formula: "Mg% / K%", note: { es: "Óptimo 2–7", en: "Optimal 2–7" } },
      { label: "K/Na", formula: "K% / Na%", note: { es: "Óptimo 1–15 (estimado)", en: "Optimal 1–15 (estimated)" } },
      { label: "Ca/Na", formula: "Ca% / Na%", note: { es: "Óptimo 9–25 (estimado)", en: "Optimal 9–25 (estimated)" } },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "conversion",
    title: { es: "4. Conversión de unidades", en: "4. Unit conversion" },
    intro: {
      es: "Los factores de conversión permiten convertir entre elemento y óxido (para dosis de fertilizante) y entre cmol(+)/kg y mg/kg (para expresar bases intercambiables en unidades de laboratorio comunes).",
      en: "Conversion factors convert between element and oxide forms (for fertilizer doses) and between cmol(+)/kg and mg/kg (to express exchangeable bases in common lab units).",
    },
    formulas: [
      { label: "P → P₂O₅", formula: "P × 2.29" },
      { label: "K → K₂O", formula: "K × 1.2" },
      { label: "Ca → CaO", formula: "Ca × 1.4" },
      { label: "Mg → MgO", formula: "Mg × 1.66" },
      { label: "cmol(+)/kg → mg/kg", formula: "Ca ×200.4 · Mg ×121.5 · K ×391 · Na ×229.9" },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "encalado",
    title: { es: "5. Requerimiento de encalado", en: "5. Liming requirement" },
    intro: {
      es: "Cuando la saturación de Ca está por debajo de la meta o el pH/acidez lo indican, se calcula el déficit de Ca, se convierte a CaO requerido, se traduce a dosis del material seleccionado (cal agrícola, dolomita o yeso, Sección 12–14) y se ajusta por el Poder Relativo de Neutralización Total (PRNT) del producto.",
      en: "When Ca saturation is below target or pH/acidity indicate it, the Ca deficit is calculated, converted to required CaO, translated into a dose of the selected material (agricultural lime, dolomite or gypsum, Sections 12–14), and adjusted by the product's Relative Total Neutralizing Power (PRNT/RNTP).",
    },
    formulas: [
      { label: "Ca objetivo", formula: "CICe × (%Ca meta / 100)" },
      { label: "Déficit de Ca", formula: "Ca objetivo − Ca actual (cmol(+)/kg)" },
      { label: "CaO requerido", formula: "Ca requerido (kg/ha) × 1.40" },
      { label: "Dosis teórica", formula: "CaO requerido / (%CaO del material / 100)" },
      { label: "Dosis ajustada por PRNT", formula: "Dosis teórica / (PRNT / 100)" },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "dosis",
    title: { es: "6. Plan de fertilización y dosis por cultivo", en: "6. Fertilizer plan and crop doses" },
    intro: {
      es: "La demanda de cada nutriente se calcula a partir del rendimiento objetivo y el coeficiente de extracción del cultivo (28 cultivos). El suministro del suelo se estima con el nutriente disponible, profundidad de muestreo y densidad aparente. La dosis final descuenta el suministro y ajusta por la eficiencia de uso del fertilizante, la cual puede fijarse manualmente o según el sistema de riego.",
      en: "Nutrient demand is computed from the target yield and the crop's extraction coefficient (28 crops). Soil supply is estimated from the available nutrient, sampling depth, and bulk density. The final dose subtracts supply and adjusts for fertilizer-use efficiency, which can be set manually or based on the irrigation system.",
    },
    formulas: [
      { label: "Demanda nutriente", formula: "Rendimiento objetivo (t/ha) × coeficiente de extracción (kg/t)" },
      { label: "Suministro del suelo", formula: "kg/ha = mg/kg × densidad aparente (g/cm³) × profundidad (cm) × 0.1" },
      { label: "Dosis final", formula: "(Demanda − Suministro) / Eficiencia de uso" },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "riego",
    title: { es: "7. Eficiencia de uso de nutrientes por sistema de riego", en: "7. Nutrient-use efficiency by irrigation system" },
    intro: {
      es: "Los rangos de eficiencia de uso (%) por nutriente para tres sistemas de riego: surco/inundación, aspersión/pivote y goteo/microaspersión. El promedio del rango se usa para autocompletar la eficiencia de N, P, K y Mg en el plan de fertilización, aunque el usuario puede sobrescribirla manualmente.",
      en: "Use-efficiency ranges (%) per nutrient are reported for three irrigation systems: furrow/flood, sprinkler/pivot and drip/micro-sprinkler. The midpoint of the range is used to auto-fill N, P, K and Mg efficiency in the fertilizer plan, though the user may override it manually.",
    },
    formulas: [
      { label: "Eficiencia aplicada", formula: "(min% + max%) / 2 (redondeado a 1 decimal)" },
    ],
    citation: SOURCE_CITATION,
  },
  {
    id: "salinidad",
    title: { es: "8. Salinidad, sodicidad y lixiviación", en: "8. Salinity, sodicity and leaching" },
    intro: {
      es: "El Porcentaje de Sodio Intercambiable (PSI) y la Relación de Adsorción de Sodio (SAR) diagnostican riesgo de sodicidad. El requerimiento de yeso corrige el exceso de sodio, y el requerimiento de lixiviación (RL) estima el agua adicional necesaria para controlar la salinidad del suelo con el agua de riego disponible.",
      en: "Exchangeable Sodium Percentage (PSI/ESP) and the Sodium Adsorption Ratio (SAR) diagnose sodicity risk. Gypsum requirement corrects excess sodium, and the leaching requirement (LR) estimates the extra water needed to control soil salinity with the available irrigation water.",
    },
    formulas: [
      { label: "SAR", formula: "Na / √((Ca + Mg) / 2)" },
      { label: "PSI (ESP)", formula: "(Na intercambiable / CIC) × 100" },
      { label: "Yeso (meq/100g)", formula: "CICe × ((PSI actual − PSI meta) / 100)" },
      { label: "Yeso (mg/100g)", formula: "[CICe × ((PSI actual − PSI meta)/100)] × 87" },
      { label: "Yeso (kg/t)", formula: "[CICe × ((PSI actual − PSI meta)/100)] × 1.74" },
      { label: "Requerimiento de lixiviación (RL)", formula: "ECw / (5 × ECe meta − ECw) × 100" },
      { label: "Agua total requerida", formula: "ET / (1 − RL)" },
      { label: "Porosidad", formula: "(1 − densidad aparente / densidad de partícula) × 100" },
    ],
    citation: "Ayers & Westcot (FAO 29) · USDA Salinity Laboratory Handbook 60",
  },
  {
    id: "dop",
    title: { es: "9. Desviación del Óptimo Porcentual (DOP) — análisis foliar", en: "9. Deviation from Optimum Percentage (DOP) — foliar analysis" },
    intro: {
      es: "El método DOP compara el valor foliar de cada nutriente contra su valor óptimo (punto medio del rango de suficiencia, o un valor de referencia cuando el rango no está disponible). Un DOP negativo indica deficiencia; uno positivo indica exceso relativo al óptimo.",
      en: "The DOP method compares each foliar nutrient value against its optimum (midpoint of the sufficiency range, or a reference value when no range is available). A negative DOP indicates deficiency; a positive DOP indicates excess relative to the optimum.",
    },
    formulas: [{ label: "DOP", formula: "((valor − óptimo) / óptimo) × 100" }],
    citation: "Beaufils, E. R. (1973) — Diagnosis and Recommendation Integrated System (DRIS) / DOP method",
  },
  {
    id: "absorcion",
    title: { es: "10. Curvas de absorción de nutrientes", en: "10. Nutrient uptake curves" },
    intro: {
      es: "Las curvas de absorción muestran el ritmo relativo (%) de captación de cada macro/micronutriente por etapa fenológica del cultivo seleccionado. Son indicativas y deben ajustarse con la etapa real del cultivo, clima, riego, cultivar y recomendaciones locales; no son un reemplazo del análisis de suelo o foliar.",
      en: "Uptake curves show the relative rate (%) of macro/micronutrient absorption per phenological stage of the selected crop. They are indicative and should be adjusted with the crop's actual stage, weather, irrigation, cultivar and local recommendations; they do not replace soil or foliar analysis.",
    },
    citation: "Generalized crop nutrient-uptake profiles (agronomic literature, indicative use)",
  },
];

function drawFooter(
  pdf: import("jspdf").jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  pageNumber: number
) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text("Cultosol · Metodología / Methodology", margin, pageHeight - 8);
  pdf.text(String(pageNumber), pageWidth - margin, pageHeight - 8, { align: "right" });
}

export async function exportMethodologyPdf(fileName = "cultosol-metodologia-calculadora.pdf") {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  function newPage() {
    drawFooter(pdf, pageWidth, pageHeight, margin, pageNumber);
    pdf.addPage();
    pageNumber += 1;
    y = margin;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 20) newPage();
  }

  function drawParagraph(text: string, size = 9.5, options: { bold?: boolean; color?: [number, number, number] } = {}) {
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const color = options.color || [30, 41, 59];
    pdf.setTextColor(color[0], color[1], color[2]);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, margin, y);
      y += size * 0.45 + 2;
    }
  }

  function drawFormulaRow(f: MethodologyFormula) {
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(22, 101, 52);
    pdf.text(`• ${f.label}:`, margin + 2, y);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    const labelWidth = pdf.getTextWidth(`• ${f.label}: `);
    const formulaLines = pdf.splitTextToSize(f.formula, contentWidth - labelWidth - 4);
    pdf.text(formulaLines[0] || "", margin + 2 + labelWidth, y);
    y += 5;
    for (const extra of formulaLines.slice(1)) {
      ensureSpace(5);
      pdf.text(extra, margin + 4, y);
      y += 5;
    }
    if (f.note) {
      drawParagraph(`ES: ${f.note.es}`, 8, { color: [100, 116, 139] });
      drawParagraph(`EN: ${f.note.en}`, 8, { color: [100, 116, 139] });
    }
    y += 1;
  }

  // Cover / header
  pdf.setFillColor(240, 253, 244);
  pdf.rect(0, 0, pageWidth, 60, "F");
  pdf.setDrawColor(187, 247, 208);
  pdf.setLineWidth(0.4);
  pdf.line(0, 60, pageWidth, 60);
  pdf.setTextColor(22, 101, 52);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("Cultosol", margin, 20);
  pdf.setFontSize(13);
  pdf.text("Metodología de la Calculadora / Calculator Methodology", margin, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  const introLines = pdf.splitTextToSize(
    "Este documento describe, en español e inglés, cada fórmula y paso de cálculo utilizado por el módulo de calculadora, con sus tablas y fuentes de referencia. / This document describes, in Spanish and English, every formula and calculation step used by the calculator module, with its reference tables and sources.",
    contentWidth
  );
  pdf.text(introLines, margin, 38);
  pdf.setFontSize(8.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Generado / Generated: ${new Date().toLocaleDateString()}`, margin, 55);
  y = 68;

  for (const section of SECTIONS) {
    ensureSpace(16);
    y += 2;
    pdf.setDrawColor(220, 230, 220);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12.5);
    pdf.setTextColor(22, 101, 52);
    const titleLines = pdf.splitTextToSize(`${section.title.es} / ${section.title.en}`, contentWidth);
    for (const line of titleLines) {
      ensureSpace(6);
      pdf.text(line, margin, y);
      y += 6;
    }
    y += 1;

    drawParagraph(section.intro.es, 9.5);
    drawParagraph(section.intro.en, 9.5, { color: [71, 85, 105] });
    y += 1;

    if (section.steps?.length) {
      drawParagraph("Pasos / Steps:", 9, { bold: true });
      for (const step of section.steps) {
        drawParagraph(`ES: ${step.es}`, 8.5);
        drawParagraph(`EN: ${step.en}`, 8.5, { color: [71, 85, 105] });
      }
      y += 1;
    }

    if (section.formulas?.length) {
      drawParagraph("Fórmulas / Formulas:", 9, { bold: true });
      for (const formula of section.formulas) {
        drawFormulaRow(formula);
      }
    }

    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    ensureSpace(6);
    pdf.text(`Fuente / Source: ${section.citation}`, margin, y);
    y += 8;
  }

  drawFooter(pdf, pageWidth, pageHeight, margin, pageNumber);

  const pdfBlob = new Blob([pdf.output("arraybuffer")], { type: "application/pdf" });
  await saveBlobWithPicker(pdfBlob, fileName, "application/pdf", ".pdf", () => pdf.save(fileName));
}
