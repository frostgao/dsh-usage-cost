/**
 * Self-contained build for a standalone DSH client-plugin package.
 *
 * Produces:
 *   - lib/index.js  (ESM host half — the usageCost Remote service)
 *   - lib/client.js (browser bundle wrapped in `window.__ModuleLoader__.load`)
 *
 * The Typert artifacts (lib/typert.host.js + lib/typert.remote-client.js) are
 * committed build outputs. The upstream `typertPlugin` generator requires a full
 * workspace (`tsconfig.host.json` + a `packages/` tree), so a standalone package
 * ships its artifacts directly — see the header comment in those files.
 *
 * The client bundle inlines the generated `/remote` contribution (and zod) and
 * resolves the platform modules (React, cordis, slots) through the loader module
 * table via the injected `require`.
 */

import ts from 'typescript'

const ID = '@frostgao/dsh-usage-cost'

/**
 * Lower stage-3 decorators (`@Remote(...)`) to the `__esDecorate` helper form
 * before bundling. This is the same transform the upstream `typertPlugin` runs;
 * a standalone package reproduces just this slice since it ships its Typert
 * artifacts directly.
 */
const DECORATOR_SYNTAX = /^\s*@[A-Za-z_$][\w$]*/m

const lowerDecorators = () => ({
  name: 'dsh-lower-decorators',
  transform(code: string, id: string): { code: string; map: undefined } | undefined {
    const file = id.split('?', 1)[0] ?? id
    if (!/\.[cm]?tsx?$/.test(file) || !DECORATOR_SYNTAX.test(code)) return undefined
    const result = ts.transpileModule(code, {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2024,
        module: ts.ModuleKind.ESNext,
      },
    })
    return { code: result.outputText, map: undefined }
  },
})

/** Platform seed modules resolved from the loader module table (not bundled). */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

/** Host-half runtime imports resolved from the composition's node_modules. */
const HOST_EXTERNALS = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-query',
]

export default [
  {
    name: `${ID}/lib`,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    external: HOST_EXTERNALS,
    plugins: [lowerDecorators()],
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    clean: false,
    external: CLIENT_EXTERNALS,
    // Bundle everything not in the loader module table (zod, the /remote
    // contribution) — a require() the table cannot answer is a runtime throw.
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
