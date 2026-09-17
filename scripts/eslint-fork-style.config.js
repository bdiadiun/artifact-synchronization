// Style check for viewer/extensions/scoring-bridge. OHIF's own ESLint 9 crashes on this fork's
// legacy .eslintrc.json / @typescript-eslint 5 setup and we do not replace OHIF's tooling
// (CONVENTIONS §11), so this applies the subset of docs/CONVENTIONS.md that needs no type info.
// Usage: npm run lint:fork
import tseslint from 'typescript-eslint';

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
