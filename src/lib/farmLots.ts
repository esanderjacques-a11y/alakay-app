export function parseLotNames(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;\n]+/)
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ];
}

