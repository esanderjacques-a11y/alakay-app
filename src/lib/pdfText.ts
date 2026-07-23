/**
 * Sanitize text for jsPDF standard fonts (Helvetica / WinAnsi).
 *
 * Any character outside Latin-1 (code > 255) forces jsPDF to encode the
 * whole string as UTF-16BE. Helvetica cannot render that, so PDF viewers
 * show null bytes as junk glyphs (often looking like "&" between letters).
 */
export function pdfSafe(text: string): string {
  return String(text ?? "")
    .replace(/\u2013|\u2014|\u2212/g, "-") // en/em dash, minus
    .replace(/\u2190|\u2192|\u2194|\u21D2|\u21D0|\u21D4/g, (ch) => {
      if (ch === "\u2190" || ch === "\u21D0") return "<-";
      if (ch === "\u2194" || ch === "\u21D4") return "<->";
      return "->";
    })
    .replace(/\u00D7|\u2715|\u2716/g, "x") // multiplication / cross
    .replace(/\u00F7/g, "/") // division
    .replace(/\u2022|\u00B7|\u2023|\u2219/g, "-") // bullets / middle dot
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/\u00A0|\u202F|\u2007|\u2009/g, " ") // non-breaking / thin spaces
    .replace(/\u2264|\u2A7D/g, "<=") // ≤
    .replace(/\u2265|\u2A7E/g, ">=") // ≥
    .replace(/\u2248|\u2250/g, "~=") // ≈
    .replace(/\u2260/g, "!=") // ≠
    .replace(/\u00B1/g, "+/-") // ±
    .replace(/\u221A/g, "sqrt") // √
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => {
      const map = "⁰¹²³⁴⁵⁶⁷⁸⁹";
      return String(map.indexOf(ch));
    })
    .replace(/₂/g, "2")
    .replace(/₃/g, "3")
    .replace(/₅/g, "5")
    .replace(/₁/g, "1")
    .replace(/₄/g, "4")
    .replace(/₆/g, "6")
    .replace(/₇/g, "7")
    .replace(/₈/g, "8")
    .replace(/₉/g, "9")
    .replace(/₀/g, "0")
    // Drop remaining non-Latin-1 so jsPDF never switches a line to UTF-16BE.
    .replace(/[^\u0000-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
