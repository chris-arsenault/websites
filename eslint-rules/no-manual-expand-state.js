// drift-generated
/**
 * ESLint rule: no-manual-expand-state
 *
 * Warns when a view/component manually implements the expand/collapse toggle
 * pattern instead of using useExpandSingle() or useExpandSet() from hooks.ts.
 *
 * Detects: const [expanded*, setExpanded*] = useState(...)
 * Ignores: hooks.ts itself, store files, and non-component files.
 * See ADR 020.
 */

const expandPattern = /^(is)?expand(ed)?/i;

function isUseStateCall(callee) {
  if (callee.type === "Identifier" && callee.name === "useState") return true;
  return (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "useState"
  );
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow manual useState for expand/collapse state. Use useExpandSingle() or useExpandSet() from hooks.ts.",
    },
    messages: {
      noManualExpandState:
        "Use useExpandSingle() or useExpandSet() from hooks.ts instead of manual expand state '{{ name }}'. See ADR-020.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only enforce in view and component files
    const isTarget = /[\\/](views|components)[\\/]/.test(filename);
    if (!isTarget) return {};

    return {
      VariableDeclarator(node) {
        if (
          node.id.type !== "ArrayPattern" ||
          !node.init ||
          node.init.type !== "CallExpression"
        ) {
          return;
        }

        if (!isUseStateCall(node.init.callee)) return;

        const firstEl = node.id.elements[0];
        if (!firstEl || firstEl.type !== "Identifier") return;

        const name = firstEl.name;
        if (expandPattern.test(name)) {
          context.report({
            node,
            messageId: "noManualExpandState",
            data: { name },
          });
        }
      },
    };
  },
};
