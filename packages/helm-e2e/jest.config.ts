import type { Config } from 'jest';

const path = require('node:path');
const { TextEncoder, TextDecoder } = require('node:util');

const config: Config = {
  displayName: 'helm-e2e',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/helm-e2e',
  globals: {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
  },
  globalSetup: path.join(
    __dirname,
    '..',
    '..',
    'tools',
    'scripts',
    'start-local-registry.ts',
  ),
  globalTeardown: path.join(
    __dirname,
    '..',
    '..',
    'tools',
    'scripts',
    'stop-local-registry.ts',
  ),
};

module.exports = config;
