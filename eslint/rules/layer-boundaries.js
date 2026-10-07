// @ts-check
import path from 'node:path';

/**
 * @typedef {object} LayerSpec
 * @property {string} dir Directory of the layer, relative to the lint cwd (POSIX separators).
 * @property {readonly string[]} imports Other layers this layer may import from.
 * @property {readonly string[]} [forbiddenPackages] Bare package names this layer must not import.
 * @property {boolean} [testOnly] Test support code: only test files, layers with
 *   `mayImportTestSupport` and the layer itself may import it.
 * @property {boolean} [mayImportTestSupport] May import `testOnly` layers (dev-only tooling).
 * @property {boolean} [devOnly] Dev-server-only code: no other file may import it, so it can
 *   never reach the production bundle through the app's import graph.
 */

/**
 * @typedef {object} BoundaryOptions
 * @property {string} sourceRoot Root that contains every layer (e.g. "src").
 * @property {Record<string, LayerSpec>} layers
 */

/** @param {string} p */
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Finds the layer that owns a repo-relative POSIX path. Layers may nest (e.g.
 * `game/core/testing` inside `game/core`): the longest matching directory wins.
 * @param {string} relPath
 * @param {Record<string, LayerSpec>} layers
 * @returns {string | undefined}
 */
export function findLayer(relPath, layers) {
  return Object.entries(layers)
    .filter(([, spec]) => relPath === spec.dir || relPath.startsWith(`${spec.dir}/`))
    .sort(([, a], [, b]) => b.dir.length - a.dir.length)[0]?.[0];
}

/** @param {string} relPath */
const isTestFile = (relPath) => /\.test\.tsx?$/.test(relPath);

/**
 * @param {string} specifier
 * @param {string} pkg
 */
const isPackage = (specifier, pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`);

/**
 * Enforces the dependency direction between source layers (see ARCHITECTURE.md).
 *
 * A pure path computation instead of a module resolver: it works for files that do
 * not exist yet (so it can be unit-tested with probe sources) and needs no native deps.
 * @type {import('eslint').Rule.RuleModule}
 */
export const layerBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Enforce allowed import directions between source layers.' },
    schema: [{ type: 'object' }],
    messages: {
      forbiddenLayer: "Layer '{{from}}' must not import from layer '{{to}}'. Allowed: {{allowed}}.",
      outsideLayers:
        "Layer '{{from}}' must not import '{{target}}', which is outside every layer (composition root).",
      forbiddenPackage: "Layer '{{from}}' must not import package '{{pkg}}'.",
      testOnly:
        "Layer '{{to}}' is test support code: only test files may import it (keeps it out of the app bundle).",
      devOnly:
        "Layer '{{to}}' is dev-server-only code: nothing may import it (keeps it out of the app bundle).",
    },
  },
  create(context) {
    const options = /** @type {BoundaryOptions} */ (context.options[0]);
    const cwd = context.cwd;
    const filename = toPosix(path.relative(cwd, context.filename));
    const fromLayer = findLayer(filename, options.layers);
    const spec = fromLayer === undefined ? undefined : options.layers[fromLayer];

    /** @param {import('estree').Node} node @param {unknown} value */
    const check = (node, value) => {
      if (typeof value !== 'string') return;

      if (!value.startsWith('.')) {
        const pkg = spec?.forbiddenPackages?.find((p) => isPackage(value, p));
        if (pkg !== undefined) {
          context.report({ node, messageId: 'forbiddenPackage', data: { from: fromLayer, pkg } });
        }
        return;
      }

      const target = toPosix(
        path.relative(cwd, path.resolve(path.dirname(context.filename), value)),
      );
      if (!target.startsWith(`${options.sourceRoot}/`)) return;

      const toLayer = findLayer(target, options.layers);
      if (toLayer === fromLayer) return;
      // Files outside every layer (the composition root) only answer to the
      // dev-only and test-only rules.
      const toSpec = toLayer === undefined ? undefined : options.layers[toLayer];
      if (toSpec?.devOnly) {
        context.report({ node, messageId: 'devOnly', data: { to: toLayer } });
        return;
      }
      if (toSpec?.testOnly) {
        if (!isTestFile(filename) && !spec?.mayImportTestSupport) {
          context.report({ node, messageId: 'testOnly', data: { to: toLayer } });
        }
        return;
      }
      if (fromLayer === undefined || spec === undefined) return;
      if (toLayer === undefined) {
        context.report({ node, messageId: 'outsideLayers', data: { from: fromLayer, target } });
        return;
      }
      if (!spec.imports.includes(toLayer)) {
        context.report({
          node,
          messageId: 'forbiddenLayer',
          data: { from: fromLayer, to: toLayer, allowed: spec.imports.join(', ') || 'none' },
        });
      }
    };

    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration: (node) => {
        if (node.source) check(node.source, node.source.value);
      },
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ImportExpression: (node) => {
        if (node.source.type === 'Literal') check(node.source, node.source.value);
      },
    };
  },
};
