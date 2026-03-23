// drift-generated
/**
 * ESLint rule: no-dashboard-section-drift
 *
 * Detects when lore-weave dashboard CSS files redeclare section-spacer or
 * section-label patterns that are already provided by the shared
 * .lw-section-spacer and .lw-section-label utility classes in App.css.
 *
 * See: docs/adr/034-dashboard-section-css-consolidation.md
 * See: docs/patterns/dashboard-section-css.md
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename } from "path";

// Patterns that indicate reintroduction of prefixed section utilities.
// Matches class definitions like .XX-section-spacer or .XX-section-label
// where XX is any component prefix (but NOT lw-).
const DRIFT_PATTERNS = [
  /\.[a-z]+-section-spacer\b/,
  /\.[a-z]+-section-label\b/,
];

function readCssFile(filename, source) {
  const fileDir = dirname(filename);
  const cssPath = resolve(fileDir, source);
  if (!existsSync(cssPath)) return null;
  try {
    return { content: readFileSync(cssPath, "utf-8"), path: cssPath };
  } catch {
    return null;
  }
}

function findDriftMatches(cssContent) {
  const found = [];
  for (const pattern of DRIFT_PATTERNS) {
    const match = cssContent.match(pattern);
    if (match) found.push(match[0]);
  }
  return found;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detects lore-weave dashboard CSS files that redeclare section-spacer " +
        "or section-label patterns already provided by the shared .lw-section-spacer " +
        "and .lw-section-label utility classes in App.css.",
    },
    messages: {
      dashboardSectionDrift:
        "CSS file '{{file}}' defines component-prefixed section classes ({{matches}}). " +
        "Use the shared .lw-section-spacer and .lw-section-label classes from App.css " +
        "instead. See docs/adr/034-dashboard-section-css-consolidation.md",
    },
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (!source.startsWith("./") || !source.endsWith(".css")) return;

        const filename = context.filename || context.getFilename();
        if (!filename.includes("lore-weave/webui/src/components/dashboard/")) return;

        const css = readCssFile(filename, source);
        if (!css) return;

        // Skip if the CSS file references the shared lw- utilities
        if (css.content.includes("lw-section-spacer") || css.content.includes("lw-section-label")) return;

        const found = findDriftMatches(css.content);
        if (found.length > 0) {
          context.report({
            node,
            messageId: "dashboardSectionDrift",
            data: { file: basename(css.path), matches: found.join(", ") },
          });
        }
      },
    };
  },
};
