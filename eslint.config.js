// Root ESLint 9 flat config, shared across the npm workspaces (decision A-13).
// Covers host-app source, the contract package, and the repo's node scripts.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

// A-13: string enums only. In the typescript-eslint v8 AST enum members sit under a TSEnumBody
// node, so the selectors use the descendant combinator rather than a direct-child one.
// Missing initializers (implicit numbers) are caught by prefer-enum-initializers.
const numericEnumMemberSelector =
  'TSEnumDeclaration TSEnumMember > :matches(Literal[raw=/^\\d/], UnaryExpression)';
const constEnumSelector = 'TSEnumDeclaration[const=true]';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'viewer/**', 'docs/site/**'],
  },
  {
    files: ['host-app/src/**/*.{ts,tsx}', 'packages/contract/src/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.es2023,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: numericEnumMemberSelector,
          message: 'Numeric enums are forbidden (A-13); use string enums instead.',
        },
        {
          selector: constEnumSelector,
          message: 'const enum is forbidden (A-13); use a regular string enum.',
        },
      ],

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
      ],
    },
  },
  {
    files: ['host-app/src/**/*.{tsx}'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
    },
  },
  {
    files: ['host-app/vite.config.ts'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
);
