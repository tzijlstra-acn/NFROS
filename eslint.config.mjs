// @ts-check
//
// ESLint flat config for NFR WorkOS.
//
// Plugin rules (@typescript-eslint/*, eslint-plugin-next) are intentionally
// commented out below because those packages are not in devDependencies.
// When they are added, uncomment the relevant sections.
//
// The native rules below run as-is with any ESLint >= 8.
//

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  // --- Global ignores ---
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-verify/**",
      "out/**",
      "dist/**",
      "public/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "exports/**",
    ],
  },

  // --- Production source: src/ and app/ ---
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      // Console calls are allowed in demo context but flagged for review.
      "no-console": "warn",

      // Unused variables should be prefixed with _ when intentional.
      "no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Prefer const over let where possible.
      "prefer-const": "error",

      // No debugger statements in committed code.
      "no-debugger": "error",

      // Consistent equality checks.
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },

  // --- Scripts: allow console, looser rules ---
  {
    files: ["scripts/**/*.{ts,mjs,js}"],
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
    },
  },

  // --- Test files: allow any, looser rules ---
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
    },
  },
];

export default config;

/*
 * When @typescript-eslint and eslint-plugin-next are installed, extend the
 * production source block above with:
 *
 *   import tseslint from "typescript-eslint";
 *   import nextPlugin from "@next/eslint-plugin-next";
 *
 *   // Then add to the production source rule set:
 *   "@typescript-eslint/no-explicit-any": "error",
 *   "@typescript-eslint/no-floating-promises": "error",
 *   "@typescript-eslint/consistent-type-imports": "warn",
 *   "@next/next/no-html-link-for-pages": "error",
 */
