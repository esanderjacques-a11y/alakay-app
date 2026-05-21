import { readFileSync, writeFileSync } from "fs";

const p = "src/app/page.tsx";
let s = readFileSync(p, "utf8");

const menuStart = s.indexOf("{showCustomDataMenu ? (");
if (menuStart > 0) {
  const menuEnd = s.indexOf("{message &&", menuStart);
  let block = s.slice(menuStart, menuEnd);
  block = block.replace(
    /<\/div>\s*\n\s*\)\}/,
    "</section>\n            ) : null}"
  );
  s = s.slice(0, menuStart) + block + s.slice(menuEnd);
  console.log("menu patched");
}

const start = s.indexOf("  async function exportToPdf() {");
const end = s.indexOf("  const visibleGroups = {", start);
if (start > 0 && end > start) {
  const nf = `  async function exportToPdf() {
    setExportingPdf(true);
    try {
      const locales = { en: "en-US", fr: "fr-FR", es: "es-ES", ht: "ht-HT" };
      await exportAnalysisPdf({
        t,
        results,
        groupedResults,
        missingResults,
        textureSummary,
        isGeneralCrop,
        locale: locales[language] || "en-US",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      alert(t.pdfExportFailed);
    } finally {
      setExportingPdf(false);
    }
  }

`;
  s = s.slice(0, start) + nf + s.slice(end);
  console.log("pdf patched");
}

const authStart = s.indexOf("function AuthTopBar");
const backStart = s.indexOf("function BackButton");
if (authStart > 0 && backStart > authStart) {
  s = s.slice(0, authStart) + s.slice(backStart);
  console.log("headers removed");
}

writeFileSync(p, s);
