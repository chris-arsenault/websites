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
import maxJsxProps from "./eslint-rules/max-jsx-props.js";
import noAppCssBaseDuplication from "./eslint-rules/no-app-css-base-duplication.js";
import noArchivistSectionDrift from "./eslint-rules/no-archivist-section-drift.js";
import noBulkShellDrift from "./eslint-rules/no-bulk-shell-drift.js";
import noCosmoEditorDrift from "./eslint-rules/no-cosmo-editor-drift.js";
import noCrossAppAlias from "./eslint-rules/no-cross-app-alias.js";
import noDashboardSectionDrift from "./eslint-rules/no-dashboard-section-drift.js";
import noDirectFetch from "./eslint-rules/no-direct-fetch.js";
import noDirectStoreImport from "./eslint-rules/no-direct-store-import.js";
import noDuplicateComponentCss from "./eslint-rules/no-duplicate-component-css.js";
import noErrorBoundaryWithoutBase from "./eslint-rules/no-error-boundary-without-base.js";
import noEscapeHatches from "./eslint-rules/no-escape-hatches.js";
import noHintCssDuplication from "./eslint-rules/no-hint-css-duplication.js";
import noInlineIdGeneration from "./eslint-rules/no-inline-id-generation.js";
import noInlineKeyboardNav from "./eslint-rules/no-inline-keyboard-nav.js";
import noInlineStyles from "./eslint-rules/no-inline-styles.js";
import noJsFileExtension from "./eslint-rules/no-js-file-extension.js";
import noManualAsyncState from "./eslint-rules/no-manual-async-state.js";
import noManualExpandState from "./eslint-rules/no-manual-expand-state.js";
import noManualViewHeader from "./eslint-rules/no-manual-view-header.js";
import noMatrixCssDuplication from "./eslint-rules/no-matrix-css-duplication.js";
import noNonVitestTesting from "./eslint-rules/no-non-vitest-testing.js";
import noPanelCssDuplication from "./eslint-rules/no-panel-css-duplication.js";
import noRawErrorDiv from "./eslint-rules/no-raw-error-div.js";
import noRemoteShellDrift from "./eslint-rules/no-remote-shell-drift.js";
import noSchemaEditorCssDrift from "./eslint-rules/no-schema-editor-css-drift.js";
import noTabCompanionCss from "./eslint-rules/no-tab-companion-css.js";
import noToggleCssDrift from "./eslint-rules/no-toggle-css-drift.js";
import noVersionToolbarDrift from "./eslint-rules/no-version-toolbar-drift.js";
import noViewerPatternDrift from "./eslint-rules/no-viewer-pattern-drift.js";
import noVizOverlayDrift from "./eslint-rules/no-viz-overlay-drift.js";
import noVizUtilityDrift from "./eslint-rules/no-viz-utility-drift.js";

const localPlugin = {
  rules: {
    "max-jsx-props": maxJsxProps,
    "no-app-css-base-duplication": noAppCssBaseDuplication,
    "no-archivist-section-drift": noArchivistSectionDrift,
    "no-bulk-shell-drift": noBulkShellDrift,
    "no-cosmo-editor-drift": noCosmoEditorDrift,
    "no-cross-app-alias": noCrossAppAlias,
    "no-dashboard-section-drift": noDashboardSectionDrift,
    "no-direct-fetch": noDirectFetch,
    "no-direct-store-import": noDirectStoreImport,
    "no-duplicate-component-css": noDuplicateComponentCss,
    "no-error-boundary-without-base": noErrorBoundaryWithoutBase,
    "no-escape-hatches": noEscapeHatches,
    "no-hint-css-duplication": noHintCssDuplication,
    "no-inline-id-generation": noInlineIdGeneration,
    "no-inline-keyboard-nav": noInlineKeyboardNav,
    "no-inline-styles": noInlineStyles,
    "no-js-file-extension": noJsFileExtension,
    "no-manual-async-state": noManualAsyncState,
    "no-manual-expand-state": noManualExpandState,
    "no-manual-view-header": noManualViewHeader,
    "no-matrix-css-duplication": noMatrixCssDuplication,
    "no-non-vitest-testing": noNonVitestTesting,
    "no-panel-css-duplication": noPanelCssDuplication,
    "no-raw-error-div": noRawErrorDiv,
    "no-remote-shell-drift": noRemoteShellDrift,
    "no-schema-editor-css-drift": noSchemaEditorCssDrift,
    "no-tab-companion-css": noTabCompanionCss,
    "no-toggle-css-drift": noToggleCssDrift,
    "no-version-toolbar-drift": noVersionToolbarDrift,
    "no-viewer-pattern-drift": noViewerPatternDrift,
    "no-viz-overlay-drift": noVizOverlayDrift,
    "no-viz-utility-drift": noVizUtilityDrift,
  },
};

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
      complexity: ["error", 10],
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 75, skipBlankLines: true, skipComments: true }],
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

  // Local custom rules — all files (rules self-filter by filename)
  {
    plugins: {
      local: localPlugin,
    },
    rules: {
      "local/no-app-css-base-duplication": "warn",
      "local/no-archivist-section-drift": "warn",
      "local/no-bulk-shell-drift": "warn",
      "local/no-cosmo-editor-drift": "warn",
      "local/no-cross-app-alias": "warn",
      "local/no-dashboard-section-drift": "warn",
      "local/no-duplicate-component-css": "warn",
      "local/no-error-boundary-without-base": "warn",
      "local/no-escape-hatches": "warn",
      "local/no-hint-css-duplication": "warn",
      "local/no-inline-id-generation": "warn",
      "local/no-inline-keyboard-nav": "warn",
      "local/no-inline-styles": "warn",
      "local/no-js-file-extension": "warn",
      "local/no-matrix-css-duplication": "warn",
      "local/no-non-vitest-testing": "warn",
      "local/no-panel-css-duplication": "warn",
      "local/no-raw-error-div": "warn",
      "local/no-remote-shell-drift": "warn",
      "local/no-schema-editor-css-drift": "warn",
      "local/no-tab-companion-css": "warn",
      "local/no-toggle-css-drift": "warn",
      "local/no-version-toolbar-drift": "warn",
      "local/no-viewer-pattern-drift": "warn",
      "local/no-viz-overlay-drift": "warn",
      "local/no-viz-utility-drift": "warn",
    },
  },

  // Disable no-js-file-extension for files that must be .js
  {
    files: ["eslint.config.js", "eslint-rules/**/*.js", "**/public/**/*.js"],
    rules: {
      "local/no-js-file-extension": "off",
    },
  },

  // Public config files use intentional fallback patterns
  {
    files: ["**/public/config.js"],
    rules: {
      "local/no-escape-hatches": "off",
    },
  },

  // Scorchbook frontend — downgraded + scorchbook-specific rules
  {
    files: ["apps/scorchbook/frontend/src/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "local/max-jsx-props": "warn",
      "local/no-direct-fetch": "warn",
      "local/no-direct-store-import": "warn",
      "local/no-manual-async-state": "warn",
      "local/no-manual-expand-state": "warn",
      "local/no-manual-view-header": "warn",
      // Drift rules from other projects — false positives on scorchbook CSS
      "local/no-raw-error-div": "off",
      "local/no-viewer-pattern-drift": "off",
      "local/no-toggle-css-drift": "off",
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
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "warn",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "sonarjs/prefer-regexp-exec": "warn",
      "sonarjs/prefer-read-only-props": "warn",
      "sonarjs/deprecation": "warn",
      "sonarjs/different-types-comparison": "error",
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
