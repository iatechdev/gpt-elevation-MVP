// ES-385 (etapa 1): ESLint SOLO con reglas de defecto como bloqueantes. `no-unused-vars` va en «warn» (no bloquea; se limpia por lotes en la etapa 2).
// Las reglas del conjunto «recommended» que marcan código de seguridad INTENCIONAL (Unicode, controles) quedan fuera: no-control-regex, no-misleading-character-class, no-irregular-whitespace, no-useless-escape.
const globals = require('globals');

const BUG_RULES = {
  'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error',
  'no-unsafe-finally': 'error', 'no-const-assign': 'error', 'no-undef': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error',
  'no-empty-pattern': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-cond-assign': 'error', 'no-constant-binary-expression': 'error',
  'no-func-assign': 'error', 'no-import-assign': 'error', 'no-class-assign': 'error', 'no-ex-assign': 'error', 'no-obj-calls': 'error',
  'no-sparse-arrays': 'error', 'no-unsafe-negation': 'error', 'no-unsafe-optional-chaining': 'error', 'no-setter-return': 'error',
  'getter-return': 'error', 'no-compare-neg-zero': 'error', 'no-redeclare': 'error', 'no-this-before-super': 'error', 'constructor-super': 'error',
  'require-yield': 'error', 'no-loss-of-precision': 'error', 'no-prototype-builtins': 'off',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
};

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'migrations/**/*.sql'] },
  { files: ['**/*.js', '**/*.cjs'], languageOptions: { sourceType: 'commonjs', ecmaVersion: 2023, globals: { ...globals.node } }, rules: BUG_RULES },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module', ecmaVersion: 2023, globals: { ...globals.node } }, rules: BUG_RULES },
  // Las pruebas con navegador (Playwright) ejecutan funciones dentro de la página: tienen window, document, localStorage…
  { files: ['test/integration/es-15-postgres.cjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
