import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactPerf from "eslint-plugin-react-perf";
import jsxA11y from "eslint-plugin-jsx-a11y";
import sonarjs from "eslint-plugin-sonarjs";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "infrastructure/",
      "scripts/",
      "**/scripts/",
      "**/*.min.js",
      // Non-TS apps — no eslint config needed
      "apps/ru-ai.net/",
      "apps/stack-atlas/",
    ],
  },

  // Base JS rules + complexity limits
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      complexity: ["warn", 10],
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 75, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
    },
  },

  // TypeScript: recommended type-checked rules
  ...tseslint.configs.recommendedTypeChecked,

  // TypeScript parser options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Disable type-checked rules for non-TS files
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Backend / Node.js code
  {
    files: [
      "apps/ahara.io/backend/src/**/*.ts",
      "apps/scorchbook/backend/src/**/*.ts",
      "apps/auth-trigger/src/**/*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2025,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
    },
  },

  // Frontend: React + Browser + Accessibility
  {
    files: [
      "apps/ahara.io/src/**/*.{ts,tsx}",
      "apps/scorchbook/frontend/src/**/*.{ts,tsx}",
    ],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-perf": reactPerf,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2025,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      "react-perf/jsx-no-new-object-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-new-array-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-new-function-as-prop": ["warn", { nativeAllowList: "all" }],
      "react-perf/jsx-no-jsx-as-prop": ["warn", { nativeAllowList: "all" }],
      "react/jsx-no-constructed-context-values": "warn",
    },
  },

  // Scorchbook frontend — downgraded rules for pre-existing issues
  {
    files: ["apps/scorchbook/frontend/src/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
    },
  },

  // SonarJS: full recommended config
  sonarjs.configs.recommended,

  // Type-checked rules — downgraded for pre-existing code
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "sonarjs/prefer-regexp-exec": "warn",
      "sonarjs/prefer-read-only-props": "warn",
      "sonarjs/deprecation": "warn",
      "sonarjs/different-types-comparison": "warn",
      "sonarjs/function-return-type": "warn",
    },
  },

  // Scorchbook — downgraded sonarjs rules for pre-existing issues
  {
    files: [
      "apps/scorchbook/frontend/src/**/*.{ts,tsx}",
      "apps/scorchbook/backend/src/**/*.ts",
    ],
    rules: {
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/cognitive-complexity": "warn",
      "sonarjs/no-identical-functions": "warn",
    },
  },
  {
    files: ["apps/scorchbook/backend/src/**/*.ts"],
    rules: {
      "sonarjs/slow-regex": "warn",
      "sonarjs/no-ignored-exceptions": "warn",
      "sonarjs/pseudo-random": "warn",
      "sonarjs/no-unused-vars": "warn",
    },
  },

  // Prettier: must be last
  prettier,
);
