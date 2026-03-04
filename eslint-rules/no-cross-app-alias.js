// drift-generated
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow non-standard Vite resolve.alias entries in vite.config files",
    },
    messages: {
      bannedAlias:
        '{{reason}} Only "@lib" \u2192 "../lib" is permitted for apps with a sibling lib directory. See docs/patterns/vite-alias-configuration.md',
    },
    schema: [],
  },

  create(context) {
    const filename = context.filename || context.getFilename();
    if (!/(^|[/\\])vite\.config\.[jt]s$/.test(filename)) return {};

    function getPropertyName(node) {
      return node.key?.name || node.key?.value;
    }

    function isResolveAliasProperty(propNode) {
      const aliasObj = propNode.parent;
      if (aliasObj?.type !== "ObjectExpression") return false;

      const aliasProp = aliasObj.parent;
      if (aliasProp?.type !== "Property") return false;
      if (getPropertyName(aliasProp) !== "alias") return false;

      const resolveObj = aliasProp.parent;
      if (resolveObj?.type !== "ObjectExpression") return false;

      const resolveProp = resolveObj.parent;
      if (resolveProp?.type !== "Property") return false;
      return getPropertyName(resolveProp) === "resolve";
    }

    function getPathArgument(callExpr) {
      if (callExpr?.type !== "CallExpression") return null;
      const args = callExpr.arguments;
      if (!args?.length) return null;
      const lastArg = args[args.length - 1];
      if (lastArg?.type === "Literal" && typeof lastArg.value === "string") {
        return lastArg.value;
      }
      return null;
    }

    function classifyAlias(aliasName, pathArg) {
      if (pathArg && /packages\/.*\/src\//.test(pathArg)) {
        return `Package source alias "${aliasName}" is redundant \u2014 workspace resolution already reaches the source.`;
      }
      if (pathArg && /\.\.\/\.\.\//.test(pathArg)) {
        return `Cross-app alias "${aliasName}" creates hidden coupling between MFEs.`;
      }
      return `Non-standard alias "${aliasName}" is not in the permitted set.`;
    }

    return {
      Property(node) {
        if (!isResolveAliasProperty(node)) return;

        const aliasName = getPropertyName(node);
        if (!aliasName) return;

        const pathArg = getPathArgument(node.value);

        // Allow: '@lib' -> '../lib'
        if (aliasName === "@lib" && pathArg === "../lib") return;

        context.report({
          node,
          messageId: "bannedAlias",
          data: { reason: classifyAlias(aliasName, pathArg) },
        });
      },
    };
  },
};
