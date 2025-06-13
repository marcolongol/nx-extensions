import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import nxEslintPlugin from '@nx/eslint-plugin';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist'],
  },
  ...compat.extends('plugin:prettier/recommended'),
  { plugins: { '@nx': nxEslintPlugin } },
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...compat
    .config({
      plugins: ['unused-imports', 'sort-class-members', '@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:import/recommended',
        'plugin:unicorn/recommended',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
      settings: {
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
      root: true,
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      rules: {
        ...config.rules,
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
        'import/no-extraneous-dependencies': 'off',
        'import/order': [
          'error',
          {
            alphabetize: {
              caseInsensitive: false,
              order: 'asc',
            },
            groups: [
              'builtin',
              'external',
              'internal',
              ['parent', 'sibling', 'index'],
            ],
            'newlines-between': 'always',
          },
        ],
        'no-unused-vars': 'warn',
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
          2,
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
    })),
  ...compat
    .config({
      extends: ['plugin:@nx/typescript', 'plugin:import/typescript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
      rules: {
        ...config.rules,
      },
      languageOptions: {
        parserOptions: {
          project: [
            'tsconfig.*?.json',
            'packages/*/tsconfig.*?.json',
            'libs/*/tsconfig.*?.json',
          ],
        },
      },
    })),
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({
      env: {
        jest: true,
      },
    })
    .map((config) => ({
      ...config,
      files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
      rules: {
        ...config.rules,
      },
    })),
];
