import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import js from "@eslint/js";

export default [
  // ── Ignored paths (Global en ESLint 9 Flat Config) ───────────────────────────
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist-build-win/**",
      ".electron-dist/**",
      "dist_electron/**",
      "build-resources/**",
      "node_modules/**",
      "next-env.d.ts",
      "**/*.js",
      "src/__tests__/**",
      "tests/**",
      "lfeds/**",
      "ecos-core/**",
    ],
  },

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

      // Migración progresiva:
      // permite identificar estos casos sin bloquear el lint completo.
      "react-hooks/set-state-in-effect": "warn",

      // any — warn only, large codebase migration in progress
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-require-imports": "off",

      // @ts-nocheck is used legitimately in a few auto-generated / obfuscated files
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-nocheck": false,
          "ts-expect-error": "allow-with-description"
        }
      ],

      // React Compiler rules — not available in current react-hooks plugin version
      // "react-hooks/react-compiler": "warn",
      // "react-hooks/immutability": "warn",
      // "react-hooks/unsupported-syntax": "warn",

      // Standard JS — warn only
      "no-undef": "off",
      "no-empty": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "warn",
      "no-useless-catch": "warn",
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
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
];