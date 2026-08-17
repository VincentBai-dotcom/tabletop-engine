import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const WEB_SOURCE_FILES = [
  "examples/splendor/web/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: WEB_SOURCE_FILES,
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: [
      "**/*.jsonc",
      "**/tsconfig.json",
      "**/tsconfig.app.json",
      "**/tsconfig.node.json",
    ],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    language: "json/json5",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/commonmark",
    extends: ["markdown/recommended"],
  },
  eslintConfigPrettier,
  globalIgnores([
    "**/AGENTS.md",
    "Splendor.md",
    "nobile tiles.md",
    "docs/**",
    "packages/create/templates/**",
    "**/dist",
    "**/coverage",
    "**/tsconfig.tsbuildinfo",
    "**/.husky/_",
    "**/.venv",
  ]),
]);
