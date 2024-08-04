import path from 'node:path';

export default {
  displayName: 'helm-e2e',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/helm-e2e',
  globalSetup: path.join(
    // eslint-disable-next-line unicorn/prefer-module
    __dirname,
    '..',
    '..',
    'tools',
    'scripts',
    'start-local-registry.ts',
  ),
  globalTeardown: path.join(
    // eslint-disable-next-line unicorn/prefer-module
    __dirname,
    '..',
    '..',
    'tools',
    'scripts',
    'stop-local-registry.ts',
  ),
};
