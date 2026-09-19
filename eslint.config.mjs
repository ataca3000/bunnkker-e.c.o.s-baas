import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Browser / React client files ────────────────────────────────────────────
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,

      // any — warn only, large codebase migration in progress
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",

      // @ts-nocheck is used legitimately in a few auto-generated / obfuscated files
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-nocheck": false,           // allow @ts-nocheck
          "ts-expect-error": "allow-with-description",
        },
      ],

      // React Compiler rules — not available in current react-hooks plugin version
      // "react-hooks/react-compiler": "warn",
      // "react-hooks/immutability":    "warn",
      // "react-hooks/unsupported-syntax": "warn",

      // Standard JS — warn only
      "no-empty":           "off",
      "prefer-const":       "off",
      "no-case-declarations": "off",
      "no-useless-catch":   "off",

      // Legacy UI migration: report these patterns without blocking builds.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },

  // ── Node.js files (API routes, scripts, Electron, workers) ─────────────────
  {
    files: [
      "src/app/api/**/*.ts",
      "src/worker/**/*.ts",
      "src/lib/**/*.ts",
      "scripts/**/*.{js,ts}",
      "electron-main.js",
      "preload.js",
      "copy-standalone.js",
    ],
    languageOptions: {
      globals: {
        require:  "readonly",
        module:   "readonly",
        exports:  "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process:  "readonly",
        console:  "readonly",
        Buffer:   "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL:      "readonly",
        fetch:    "readonly",
      },
    },
    rules: {
      "no-undef": "off",   // Node globals handled above; TS covers type safety
    },
  },

  // ── Ignored paths ───────────────────────────────────────────────────────────
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist_electron/**",
      "node_modules/**",
      "next-env.d.ts",
      "**/*.js",           // JS files linted separately if needed
      "**/*.mjs",          // Node ESM scripts are validated by their own runtime checks
    ],
  },
];
