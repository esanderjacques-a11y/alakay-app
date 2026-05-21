import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  globalIgnores([
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
