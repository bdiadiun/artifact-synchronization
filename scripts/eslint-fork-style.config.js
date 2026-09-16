// Style check for our OHIF extension (viewer/extensions/scoring-bridge).
//
// The fork's own ESLint does not run at OHIF v3.12.17 (ESLint 9 with a legacy .eslintrc.json and
// @typescript-eslint 5 crashes while loading rules), and we do not replace OHIF's tooling
// (CONVENTIONS §11). This config applies the subset of docs/CONVENTIONS.md rules that need no type
// information, so the extension is held to the same style as host-app.
// Usage: npm run lint:fork
import tseslint from 'typescript-eslint';

// Same selectors as eslint.config.js (A-13).
const numericEnumMemberSelector =
  'TSEnumDeclaration TSEnumMember > :matches(Literal[raw=/^\\d/], UnaryExpression)';
const constEnumSelector = 'TSEnumDeclaration[const=true]';

export default tseslint.config({
  files: ['**/*.{ts,tsx,js}'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
  },
  plugins: { '@typescript-eslint': tseslint.plugin },
  linterOptions: { reportUnusedDisableDirectives: 'error' },
  rules: {
    'func-style': ['error', 'expression'],
    'prefer-arrow-callback': 'error',
    'no-console': ['error', { allow: ['warn', 'error', 'debug', 'info'] }],
    'no-restricted-syntax': [
      'error',
      { selector: numericEnumMemberSelector, message: 'Numeric enums are forbidden (A-13).' },
      { selector: constEnumSelector, message: 'const enum is forbidden (A-13).' },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/prefer-enum-initializers': 'error',
  },
});
