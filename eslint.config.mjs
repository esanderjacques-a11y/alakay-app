import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from ""eslint-config-next/core-web-vitals.js"";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-dev/**",
    ".python-ocr/**",
    "**/.python-ocr/**",
    ".easyocr-models/**",
    "**/.easyocr-models/**",
    ".ocr-temp/**",
    "**/.ocr-temp/**",
    ".tessdata/**",
    "**/.tessdata/**",
    ".npm-cache/**",
    "**/.npm-cache/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
