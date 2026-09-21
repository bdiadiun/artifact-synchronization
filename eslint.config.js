// Root ESLint 9 flat config, shared across the npm workspaces (decision A-13).
// Covers host-app source, the published packages, and the repo's node scripts.
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
const inlineStyleObjectSelector =
  "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression";

// A function created inside a JSX prop is a new identity on every render and hides it from the
// component body, where every function a component renders with belongs (CONVENTIONS §6).
const inlineEventHandlerSelector =
  "JSXAttribute > JSXExpressionContainer > :matches(ArrowFunctionExpression, FunctionExpression, CallExpression[callee.property.name='bind'])";

// Every module keeps its types next to it, not in it (CONVENTIONS §6): the `{Name}.props.ts` file
// holds the interfaces, type aliases and styles, and `{Name}.ts(x)` imports them back.
const typeDeclarationSelector = ':matches(TSInterfaceDeclaration, TSTypeAliasDeclaration)';

const enumRestrictions = [
  {
    selector: numericEnumMemberSelector,
    message: 'Numeric enums are forbidden (A-13); use string enums instead.',
  },
  {
    selector: constEnumSelector,
    message: 'const enum is forbidden (A-13); use a regular string enum.',
  },
];

const jsxRestrictions = [
  {
    selector: inlineStyleObjectSelector,
    message:
      'Inline style objects are forbidden (CONVENTIONS §6); use styles from {Name}.props.ts.',
  },
  {
    selector: inlineEventHandlerSelector,
    message:
      'Event handler props take a named handleX function (CONVENTIONS §6); no functions created inline.',
  },
];

const siblingTypesRestriction = {
  selector: typeDeclarationSelector,
  message:
    'An interface or type declaration belongs in the sibling {Name}.props.ts file (CONVENTIONS §6); import it back from there.',
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'viewer/**', 'docs/site/**'],
  },
  {
    files: [
      'host-app/src/**/*.{ts,tsx}',
      'packages/contract/src/**/*.ts',
      'packages/orchestrator/src/**/*.ts',
      'packages/viewer-bridge/src/**/*.ts',
      'packages/viewer-adapter/src/**/*.ts',
    ],
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
      // Size and shape limits (CONVENTIONS §5). Errors since F-33: every unit is under them, so a
      // new one that is not has to be split rather than merged.
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],
      'no-restricted-syntax': ['error', ...enumRestrictions],

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/prefer-enum-initializers': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // Rest siblings are the idiomatic way to build an object without one key (tests drop a
        // required field to prove a guard rejects it).
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
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
    // Single-extension brace groups (`*.{tsx}`) do not match in minimatch; `.tsx` is the only
    // TypeScript extension that can contain JSX, so the pattern names it directly.
    files: ['host-app/src/**/*.tsx'],
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-syntax': ['error', ...enumRestrictions, ...jsxRestrictions],
    },
  },
  {
    // The sibling-types rule. Exempted: a `*.props.ts` file, which is where the declarations are
    // supposed to be; the published wire contract, which stays one self-contained file (A-15); and
    // tests, whose fixture types are part of the test, not of the design.
    files: [
      'host-app/src/**/*.ts',
      'host-app/src/**/*.tsx',
      'packages/contract/src/**/*.ts',
      'packages/orchestrator/src/**/*.ts',
      'packages/viewer-bridge/src/**/*.ts',
      'packages/viewer-adapter/src/**/*.ts',
    ],
    ignores: ['**/*.props.ts', '**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...enumRestrictions,
        ...jsxRestrictions,
        siblingTypesRestriction,
      ],
    },
  },
  {
    // The published packages build to `dist`, so their build tsconfigs exclude the tests. Each
    // package's `tsconfig.tests.json` type-checks them without emitting, and lint uses it so the
    // type-aware rules apply here too; the default project refuses past eight matching files.
    files: ['packages/*/src/__tests__/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['packages/*/tsconfig.tests.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // describe/it blocks are functions to the parser but not units of code: size limits there
    // measure the suite, not the design.
    files: ['**/__tests__/**'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
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
      // Repository scripts are CLI tools: stdout is their output channel.
      'no-console': 'off',
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
