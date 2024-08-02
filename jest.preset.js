const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  coverageReporters: ['json', 'html', 'lcov', 'text', 'clover', 'text-summary'],
};
