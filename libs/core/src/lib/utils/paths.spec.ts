import * as path from 'node:path';

import { isPathInside, resolvePathInside } from './paths';

describe('isPathInside', () => {
  it.each([
    ['apps/my-app', 'apps/my-app', true],
    ['apps/my-app', 'apps/my-app/chart', true],
    ['apps/my-app', 'apps/my-app/../my-app/chart', true],
    ['apps/my-app', 'apps/other', false],
    ['apps/my-app', 'apps/my-app/../../x', false],
    ['apps/my-app', 'apps/my-app-other', false],
    ['/workspace', '/workspace/dist', true],
    ['/workspace', '/etc', false],
  ])('isPathInside(%s, %s) is %s', (parent, target, expected) => {
    expect(isPathInside(parent, target)).toBe(expected);
  });
});

describe('resolvePathInside', () => {
  it('resolves a relative path against the root', () => {
    expect(resolvePathInside('/workspace', 'apps/my-app/chart', 'x')).toBe(
      path.resolve('/workspace/apps/my-app/chart'),
    );
  });

  it('throws when the path escapes the root', () => {
    expect(() =>
      resolvePathInside('/workspace', '../outside', 'chartFolder'),
    ).toThrow('chartFolder "../outside" must be inside "/workspace".');
  });
});
