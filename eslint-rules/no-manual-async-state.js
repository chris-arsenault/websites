// drift-generated
/**
 * ESLint rule: no-manual-async-state
 *
 * Warns when a component uses useState with names matching busy/loading/error
 * patterns for async operations. Use the useAsyncAction() hook instead.
 * See ADR 015.
 */

const asyncNamePattern = /^(is)?(busy|loading|submitting)/i;
const errorNamePattern = /error/i;

function isUseStateCall(callee) {
  if (callee.type === "Identifier" && callee.name === "useState") return true;
  return (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "useState"
  );
}

function isNullOrFalse(initArg) {
  return (
    !initArg ||
    (initArg.type === "Literal" &&
      (initArg.value === false || initArg.value === null))
  );
}

function isNullLiteral(initArg) {
  return !initArg || (initArg.type === "Literal" && initArg.value === null);
}

function getStateVarName(node) {
  if (
    node.id.type !== "ArrayPattern" ||
    !node.init ||
    node.init.type !== "CallExpression"
  ) {
    return null;
  }
  if (!isUseStateCall(node.init.callee)) return null;
  const firstEl = node.id.elements[0];
  if (!firstEl || firstEl.type !== "Identifier") return null;
  return firstEl.name;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow manual useState for async state (busy, loading, error). Use useAsyncAction() from hooks.ts instead.",
    },
    messages: {
      noManualAsyncState:
        "Use useAsyncAction() from hooks.ts instead of manual async state '{{ name }}'. See ADR-015.",
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();

    // Only enforce inside component/view/hook files, not in store create() calls
    const isComponent =
      /[\\/](views|components|hooks)[\\/]/.test(filename) ||
      filename.endsWith("hooks.ts") ||
      filename.endsWith("hooks.tsx");

    // Skip the hooks file that defines useAsyncAction itself
    if (/[\\/]hooks\.(ts|tsx)$/.test(filename)) return {};
    if (!isComponent) return {};

    // Track whether we are inside a zustand create() call
    let insideStoreCreate = 0;

    return {
      // Detect entering a zustand create() or store factory
      "CallExpression[callee.name='create']"() {
        insideStoreCreate++;
      },
      "CallExpression[callee.name='create']:exit"() {
        insideStoreCreate--;
      },

      VariableDeclarator(node) {
        if (insideStoreCreate > 0) return;

        const name = getStateVarName(node);
        if (!name) return;

        const initArg = node.init.arguments[0] ?? null;

        if (asyncNamePattern.test(name) && isNullOrFalse(initArg)) {
          context.report({ node, messageId: "noManualAsyncState", data: { name } });
          return;
        }

        if (errorNamePattern.test(name) && isNullLiteral(initArg)) {
          context.report({ node, messageId: "noManualAsyncState", data: { name } });
        }
      },
    };
  },
};
