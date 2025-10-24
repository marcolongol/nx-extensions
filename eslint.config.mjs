import nx from '@nx/eslint-plugin';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import sortClassMembers from 'eslint-plugin-sort-class-members';
import jsoncParser from 'jsonc-eslint-parser';

export default [
  {
    ignores: ['**/dist', '**/node_modules', '**/tmp'],
  },
  {
    plugins: {
      '@nx': nx,
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: [
          'tsconfig.*?.json',
          'packages/*/tsconfig.*?.json',
          'libs/*/tsconfig.*?.json',
        ],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
      prettier: prettierPlugin,
      'unused-imports': unusedImports,
      'sort-class-members': sortClassMembers,
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            'tsconfig.*?.json',
            'packages/*/tsconfig.*?.json',
            'libs/*/tsconfig.*?.json',
          ],
        },
      },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'prettier/prettier': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
        },
      ],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'sort-class-members/sort-class-members': [
        'error',
        {
          order: [
            '[static-properties]',
            '[static-methods]',
            '[conventional-private-properties]',
            '[properties]',
            'constructor',
            '[methods]',
            '[conventional-private-methods]',
          ],
          accessorPairPositioning: 'getThenSet',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        node: true,
      },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      'prettier/prettier': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: false,
          },
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  prettierConfig,
];
