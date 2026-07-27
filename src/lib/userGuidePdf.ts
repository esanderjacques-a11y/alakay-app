/**
 * Cultosol end-user guide PDF (EN / ES / FR / PT).
 * Generated on demand from the About page.
 */

import { saveBlobWithPicker } from "@/lib/fileSave";
import { pdfSafe } from "@/lib/pdfText";
import {
  PDF_BRAND,
  PDF_CARD,
  PDF_INK,
  PDF_LINE,
  PDF_MUTED,
  buildPdfContactMetaLines,
  drawPdfReportHeader,
  fetchPdfAppLogo,
  paintPdfPageWhite,
  pdfBrandName,
} from "@/lib/pdfReportHeader";

export type UserGuideLanguage = "en" | "es" | "fr" | "pt";

type GuideSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type GuideCopy = {
  docTitle: string;
  subtitle: string;
  fileStem: string;
  intro: string;
  sections: GuideSection[];
  closing: string;
};

const GUIDES: Record<UserGuideLanguage, GuideCopy> = {
  en: {
    docTitle: "Cultosol User Guide",
    subtitle: "How to analyze soil & foliar results and plan fertilization",
    fileStem: "cultosol-user-guide-en",
    intro:
      "Cultosol helps growers turn lab reports into clear field guidance. This guide walks through the essential workflow: enter values, save an analysis, explore calculators, and export a report.",
    sections: [
      {
        title: "1. Home",
        paragraphs: [
          "From Home you can start a manual analysis, import a lab document or photo, open saved reports, or jump to Calculators and your farms.",
        ],
        bullets: [
          "Input data — begin a new soil or foliar analysis.",
          "Import — Excel, CSV, PDF, TXT, or camera capture.",
          "Saved reports — reopen past analyses.",
          "Calculators — CIC, pH, salinity, DOP, fertilizer tools, and more.",
        ],
      },
      {
        title: "2. Setup: farm, crop, and sample",
        paragraphs: [
          "Link the sample to a farm and lot when you can, choose soil or foliar, and pick the crop. For soil samples, select the lab extraction method so ranges match your report.",
        ],
        bullets: [
          "You can continue without a named farm; crop selection improves interpretation.",
          "General / other crop is available when your cultivar is not listed.",
        ],
      },
      {
        title: "3. Enter lab values",
        paragraphs: [
          "On Values, search or filter parameters, then type results from your lab sheet. Switch between list, table, and pad layouts. Full-screen pad is handy for fast entry on phones.",
        ],
        bullets: [
          "Enter at least one value to unlock Save.",
          "Change units per parameter when the lab uses a different symbol.",
          "Live interpretation appears as values are entered.",
        ],
      },
      {
        title: "4. Save your analysis",
        paragraphs: [
          "Tap Save so results stay available for calculators, history, and PDF reports. Sign in to sync across devices; guest mode keeps work on this device.",
        ],
      },
      {
        title: "5. Results",
        paragraphs: [
          "Results group parameters by status (low, optimal, high, and so on). Open detail on a parameter for ranges and notes. Export a PDF when you need a shareable summary.",
        ],
      },
      {
        title: "6. Calculators",
        paragraphs: [
          "Calculators use your saved values where possible. Guided mode walks common tools step by step; Explorer lets you open any calculator. Generate a full report from the Calculators header when ready.",
        ],
        bullets: [
          "CIC / bases, pH amendments, salinity, DOP, fertilizer cost, formulation, and uptake planning.",
          "Always confirm extractant, units, and local agronomic advice before applying rates.",
        ],
      },
      {
        title: "7. Farms, calendar, and notes",
        paragraphs: [
          "Signed-in users can organize farms and lots, schedule field events, and keep notes. Use these tools to connect lab results with what happens in the field.",
        ],
      },
      {
        title: "8. Settings & appearance",
        paragraphs: [
          "In Settings you can change language, accent color, theme, and other preferences. You can also replay the first-user tour and download calculator methodology documentation.",
        ],
      },
      {
        title: "9. Tips for best results",
        paragraphs: [],
        bullets: [
          "Use the same extraction method the laboratory reported.",
          "Double-check units (mg/kg vs cmol(+)/kg, %, etc.).",
          "Cultosol supports decisions — it does not replace a licensed agronomist.",
          "Need help? Contact jesander@earth.ac.cr or use Suggest an improvement on the About page.",
        ],
      },
    ],
    closing:
      "Thank you for using Cultosol. Healthy soil decisions start with clear data — and you are in the right place.",
  },
  es: {
    docTitle: "Guía de usuario de Cultosol",
    subtitle: "Cómo interpretar análisis de suelo y foliar y planificar fertilización",
    fileStem: "cultosol-guia-usuario-es",
    intro:
      "Cultosol ayuda a convertir reportes de laboratorio en orientación clara para el campo. Esta guía cubre el flujo esencial: ingresar valores, guardar el análisis, usar calculadoras y exportar un informe.",
    sections: [
      {
        title: "1. Inicio",
        paragraphs: [
          "Desde Inicio puede comenzar un análisis manual, importar un documento o foto de laboratorio, abrir reportes guardados, o ir a Calculadoras y sus fincas.",
        ],
        bullets: [
          "Ingresar datos — nuevo análisis de suelo o foliar.",
          "Importar — Excel, CSV, PDF, TXT o cámara.",
          "Reportes guardados — reabrir análisis anteriores.",
          "Calculadoras — CIC, pH, salinidad, DOP, fertilización y más.",
        ],
      },
      {
        title: "2. Configuración: finca, cultivo y muestra",
        paragraphs: [
          "Vincule la muestra a una finca y lote cuando pueda, elija suelo o foliar y seleccione el cultivo. En suelo, indique el método de extracción del laboratorio para que los rangos coincidan.",
        ],
        bullets: [
          "Puede continuar sin nombrar finca; el cultivo mejora la interpretación.",
          "Hay opción de cultivo general / otro si no aparece su variedad.",
        ],
      },
      {
        title: "3. Ingresar valores de laboratorio",
        paragraphs: [
          "En Valores, busque o filtre parámetros y escriba los resultados. Cambie entre lista, tabla y pad. El pad a pantalla completa es útil en el teléfono.",
        ],
        bullets: [
          "Ingrese al menos un valor para habilitar Guardar.",
          "Cambie unidades por parámetro si el laboratorio usa otro símbolo.",
          "La interpretación en vivo aparece al escribir.",
        ],
      },
      {
        title: "4. Guardar el análisis",
        paragraphs: [
          "Toque Guardar para usar los resultados en calculadoras, historial e informes PDF. Inicie sesión para sincronizar; el modo invitado guarda en este dispositivo.",
        ],
      },
      {
        title: "5. Resultados",
        paragraphs: [
          "Los resultados agrupan parámetros por estado (bajo, óptimo, alto, etc.). Abra el detalle para ver rangos y notas. Exporte un PDF cuando necesite compartirlo.",
        ],
      },
      {
        title: "6. Calculadoras",
        paragraphs: [
          "Las calculadoras usan sus valores guardados cuando es posible. El modo guiado recorre herramientas comunes; el explorador abre cualquiera. Genere el informe completo desde el encabezado de Calculadoras.",
        ],
        bullets: [
          "CIC / bases, enmiendas de pH, salinidad, DOP, costo y formulación de fertilizantes, absorción.",
          "Confirme extractante, unidades y criterio agronómico local antes de aplicar dosis.",
        ],
      },
      {
        title: "7. Fincas, calendario y notas",
        paragraphs: [
          "Con sesión iniciada puede organizar fincas y lotes, programar eventos y guardar notas, conectando el laboratorio con el trabajo en campo.",
        ],
      },
      {
        title: "8. Ajustes y apariencia",
        paragraphs: [
          "En Ajustes puede cambiar idioma, color de acento, tema y otras preferencias. También puede repetir el recorrido inicial y descargar la metodología de calculadoras.",
        ],
      },
      {
        title: "9. Consejos",
        paragraphs: [],
        bullets: [
          "Use el mismo método de extracción que reportó el laboratorio.",
          "Verifique unidades (mg/kg, cmol(+)/kg, %, etc.).",
          "Cultosol apoya decisiones; no sustituye a un agrónomo profesional.",
          "Ayuda: jesander@earth.ac.cr o Sugiera una mejora en Acerca de.",
        ],
      },
    ],
    closing:
      "Gracias por usar Cultosol. Las mejores decisiones de suelo empiezan con datos claros.",
  },
  fr: {
    docTitle: "Guide utilisateur Cultosol",
    subtitle: "Analyser sol et foliaire et planifier la fertilisation",
    fileStem: "cultosol-guide-utilisateur-fr",
    intro:
      "Cultosol transforme les rapports de laboratoire en conseils de terrain clairs. Ce guide couvre le parcours essentiel : saisir les valeurs, enregistrer l’analyse, utiliser les calculateurs et exporter un rapport.",
    sections: [
      {
        title: "1. Accueil",
        paragraphs: [
          "Depuis Accueil, démarrez une analyse manuelle, importez un document ou une photo, ouvrez les rapports enregistrés, ou allez vers Calculateurs et vos fermes.",
        ],
        bullets: [
          "Saisir des données — nouvelle analyse sol ou foliaire.",
          "Importer — Excel, CSV, PDF, TXT ou caméra.",
          "Rapports enregistrés — rouvrir d’anciennes analyses.",
          "Calculateurs — CIC, pH, salinité, DOP, fertilisation, etc.",
        ],
      },
      {
        title: "2. Configuration : ferme, culture et échantillon",
        paragraphs: [
          "Associez l’échantillon à une ferme et un lot si possible, choisissez sol ou foliaire, puis la culture. Pour le sol, indiquez la méthode d’extraction du laboratoire.",
        ],
        bullets: [
          "Vous pouvez continuer sans nommer la ferme ; la culture améliore l’interprétation.",
          "Une option culture générale / autre est disponible.",
        ],
      },
      {
        title: "3. Saisir les valeurs de laboratoire",
        paragraphs: [
          "Dans Valeurs, recherchez ou filtrez les paramètres, puis saisissez les résultats. Basculez entre liste, tableau et pad. Le pad plein écran est pratique sur téléphone.",
        ],
        bullets: [
          "Saisissez au moins une valeur pour activer Enregistrer.",
          "Changez l’unité par paramètre si besoin.",
          "L’interprétation en direct apparaît à la saisie.",
        ],
      },
      {
        title: "4. Enregistrer l’analyse",
        paragraphs: [
          "Touchez Enregistrer pour les calculateurs, l’historique et les PDF. Connectez-vous pour synchroniser ; le mode invité conserve le travail sur cet appareil.",
        ],
      },
      {
        title: "5. Résultats",
        paragraphs: [
          "Les résultats regroupent les paramètres par statut (bas, optimal, élevé…). Ouvrez le détail pour les gammes et notes. Exportez un PDF pour le partager.",
        ],
      },
      {
        title: "6. Calculateurs",
        paragraphs: [
          "Les calculateurs réutilisent vos valeurs enregistrées quand c’est possible. Le mode guidé enchaîne les outils courants ; l’explorateur ouvre n’importe lequel. Générez le rapport depuis l’en-tête Calculateurs.",
        ],
        bullets: [
          "CIC / bases, amendements pH, salinité, DOP, coût et formulation d’engrais, absorption.",
          "Vérifiez extractant, unités et conseil agronomique local avant d’appliquer des doses.",
        ],
      },
      {
        title: "7. Fermes, calendrier et notes",
        paragraphs: [
          "Les utilisateurs connectés organisent fermes et lots, planifient des événements et tiennent des notes pour relier le labo au terrain.",
        ],
      },
      {
        title: "8. Réglages et apparence",
        paragraphs: [
          "Dans Réglages : langue, couleur d’accent, thème, etc. Vous pouvez aussi relancer le guide de première utilisation et télécharger la méthodologie des calculateurs.",
        ],
      },
      {
        title: "9. Conseils",
        paragraphs: [],
        bullets: [
          "Utilisez la même méthode d’extraction que le laboratoire.",
          "Vérifiez les unités (mg/kg, cmol(+)/kg, %, etc.).",
          "Cultosol aide à décider ; il ne remplace pas un agronome.",
          "Aide : jesander@earth.ac.cr ou Proposez une amélioration dans À propos.",
        ],
      },
    ],
    closing:
      "Merci d’utiliser Cultosol. De bonnes décisions de sol commencent par des données claires.",
  },
  pt: {
    docTitle: "Guia do usuário Cultosol",
    subtitle: "Como interpretar solo e foliar e planejar fertilização",
    fileStem: "cultosol-guia-usuario-pt",
    intro:
      "O Cultosol transforma laudos de laboratório em orientação clara para o campo. Este guia cobre o fluxo essencial: inserir valores, guardar a análise, usar calculadoras e exportar um relatório.",
    sections: [
      {
        title: "1. Início",
        paragraphs: [
          "No Início você pode começar uma análise manual, importar documento ou foto, abrir relatórios salvos, ou ir às Calculadoras e às fazendas.",
        ],
        bullets: [
          "Inserir dados — nova análise de solo ou foliar.",
          "Importar — Excel, CSV, PDF, TXT ou câmera.",
          "Relatórios salvos — reabrir análises anteriores.",
          "Calculadoras — CIC, pH, salinidade, DOP, fertilização e mais.",
        ],
      },
      {
        title: "2. Configuração: fazenda, cultura e amostra",
        paragraphs: [
          "Vincule a amostra a uma fazenda e lote quando possível, escolha solo ou foliar e a cultura. No solo, indique o método de extração do laboratório.",
        ],
        bullets: [
          "É possível continuar sem nomear a fazenda; a cultura melhora a interpretação.",
          "Há opção de cultura geral / outra se a variedade não estiver listada.",
        ],
      },
      {
        title: "3. Inserir valores do laboratório",
        paragraphs: [
          "Em Valores, pesquise ou filtre parâmetros e digite os resultados. Alterne entre lista, tabela e pad. O pad em tela cheia ajuda no celular.",
        ],
        bullets: [
          "Insira pelo menos um valor para habilitar Guardar.",
          "Altere unidades por parâmetro se o laboratório usar outro símbolo.",
          "A interpretação ao vivo aparece ao digitar.",
        ],
      },
      {
        title: "4. Guardar a análise",
        paragraphs: [
          "Toque em Guardar para usar os resultados em calculadoras, histórico e PDFs. Entre na conta para sincronizar; o modo convidado mantém o trabalho neste dispositivo.",
        ],
      },
      {
        title: "5. Resultados",
        paragraphs: [
          "Os resultados agrupam parâmetros por status (baixo, ótimo, alto, etc.). Abra o detalhe para faixas e notas. Exporte um PDF para compartilhar.",
        ],
      },
      {
        title: "6. Calculadoras",
        paragraphs: [
          "As calculadoras usam seus valores salvos quando possível. O modo guiado percorre ferramentas comuns; o explorador abre qualquer uma. Gere o relatório completo no cabeçalho de Calculadoras.",
        ],
        bullets: [
          "CIC / bases, correção de pH, salinidade, DOP, custo e formulação de fertilizantes, absorção.",
          "Confirme extrator, unidades e orientação agronômica local antes de aplicar doses.",
        ],
      },
      {
        title: "7. Fazendas, calendário e notas",
        paragraphs: [
          "Com login você organiza fazendas e lotes, agenda eventos e mantém notas, ligando o laboratório ao campo.",
        ],
      },
      {
        title: "8. Configurações e aparência",
        paragraphs: [
          "Em Configurações: idioma, cor de destaque, tema e outras preferências. Também pode repetir o tour inicial e baixar a metodologia das calculadoras.",
        ],
      },
      {
        title: "9. Dicas",
        paragraphs: [],
        bullets: [
          "Use o mesmo método de extração informado pelo laboratório.",
          "Verifique unidades (mg/kg, cmol(+)/kg, %, etc.).",
          "O Cultosol apoia decisões; não substitui um agrônomo.",
          "Ajuda: jesander@earth.ac.cr ou Sugira uma melhoria em Sobre.",
        ],
      },
    ],
    closing:
      "Obrigado por usar o Cultosol. Boas decisões de solo começam com dados claros.",
  },
};

export function resolveUserGuideLanguage(language: string): UserGuideLanguage {
  if (language === "es" || language === "fr" || language === "pt") {
    return language;
  }
  return "en";
}

export async function exportUserGuidePdf(
  language: UserGuideLanguage = "en"
): Promise<void> {
  const copy = GUIDES[language] ?? GUIDES.en;
  const { jsPDF } = await import("jspdf");
  const logoData = await fetchPdfAppLogo();
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const BRAND = PDF_BRAND;
  const INK = PDF_INK;
  const MUTED = PDF_MUTED;
  const LINE = PDF_LINE;
  const CARD = PDF_CARD;

  paintPdfPageWhite(pdf, pageWidth, pageHeight);

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      pdfSafe(`${pdfBrandName("Cultosol")} · ${copy.docTitle}`),
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
    paintPdfPageWhite(pdf, pageWidth, pageHeight);
    pageNumber += 1;
    y = margin;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 18) newPage();
  }

  function drawParagraph(
    text: string,
    size = 10,
    options: { bold?: boolean; color?: [number, number, number] } = {}
  ) {
    const safe = pdfSafe(text);
    if (!safe) return;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const color = options.color || INK;
    pdf.setTextColor(color[0], color[1], color[2]);
    const lines = pdf.splitTextToSize(safe, contentWidth);
    const lineHeight = size * 0.42;
    ensureSpace(lines.length * lineHeight + 2);
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + 3;
  }

  function drawBullet(text: string) {
    const safe = pdfSafe(text);
    if (!safe) return;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const bulletIndent = 5;
    const lines = pdf.splitTextToSize(safe, contentWidth - bulletIndent - 3);
    const lineHeight = 4.1;
    ensureSpace(lines.length * lineHeight + 1.5);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.rect(margin + 0.4, y - 1.7, 1.4, 1.4, "F");
    pdf.text(lines, margin + bulletIndent, y);
    y += lines.length * lineHeight + 1.2;
  }

  y = drawPdfReportHeader({
    pdf,
    pageWidth,
    margin,
    contentWidth,
    appName: pdfBrandName("Cultosol"),
    subtitle: copy.subtitle,
    title: copy.docTitle.toUpperCase(),
    contactMeta: buildPdfContactMetaLines(),
    logoData,
    startY: 12,
  });

  y += 4;
  pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
  pdf.roundedRect?.(margin, y, contentWidth, 1, 0, 0, "F");
  y += 6;

  drawParagraph(copy.intro, 10.5);

  for (const section of copy.sections) {
    ensureSpace(16);
    y += 2;
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.rect(margin, y - 3.2, 1.6, 5.2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(pdfSafe(section.title), margin + 4, y);
    y += 6;

    for (const paragraph of section.paragraphs) {
      drawParagraph(paragraph, 10);
    }
    for (const bullet of section.bullets ?? []) {
      drawBullet(bullet);
    }
  }

  ensureSpace(18);
  y += 3;
  pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;
  drawParagraph(copy.closing, 10, { bold: true, color: BRAND });

  drawFooter();

  const fileName = `${copy.fileStem}.pdf`;
  const blob = pdf.output("blob");
  await saveBlobWithPicker(
    blob,
    fileName,
    "application/pdf",
    ".pdf",
    () => pdf.save(fileName)
  );
}
