/** Shared search text normalization for app-wide find. */

export function normalizeSearchText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/đ/g, "d")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .toLowerCase()
    .replace(/[''`´ʼ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Compact form without spaces — matches "phamendment" to "pH & amendments". */
export function compactSearchText(value: string | null | undefined): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

/**
 * Score how well `query` matches the provided text parts.
 * Returns null when there is no usable match.
 */
export function scoreSearchMatch(
  parts: Array<string | null | undefined>,
  query: string
): number | null {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;

  const haystack = normalizeSearchText(parts.filter(Boolean).join(" "));
  if (!haystack) return null;

  const haystackCompact = compactSearchText(haystack);
  const needleCompact = compactSearchText(needle);
  const tokens = needle.split(" ").filter(Boolean);

  const everyTokenHits = tokens.every(
    (token) =>
      haystack.includes(token) ||
      haystackCompact.includes(token) ||
      // Allow short stems: "calc" → "calculators"
      (token.length >= 3 &&
        haystack.split(" ").some((word) => word.startsWith(token)))
  );

  const compactHits =
    needleCompact.length >= 2 && haystackCompact.includes(needleCompact);

  if (!everyTokenHits && !compactHits) return null;

  let score = 0;

  if (haystack === needle || haystackCompact === needleCompact) score += 120;
  else if (haystack.startsWith(needle) || haystackCompact.startsWith(needleCompact))
    score += 70;
  else if (haystack.includes(` ${needle} `) || haystack.includes(needle)) score += 45;
  else if (compactHits) score += 35;

  for (const token of tokens) {
    if (haystack.split(" ").some((word) => word === token)) score += 12;
    else if (haystack.split(" ").some((word) => word.startsWith(token))) score += 8;
    else if (haystack.includes(token)) score += 4;
  }

  // Prefer shorter, more precise titles when scores are close.
  score += Math.max(0, 24 - Math.min(haystack.length, 24));

  return score;
}
