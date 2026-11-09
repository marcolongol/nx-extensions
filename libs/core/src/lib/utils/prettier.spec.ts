import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { addToPrettierIgnore } from './prettier';

describe('addToPrettierIgnore', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('creates .prettierignore when it does not exist', () => {
    tree.delete('.prettierignore');

    addToPrettierIgnore(tree, ['/apps/my-app/chart/templates']);

    expect(tree.read('.prettierignore', 'utf8')).toBe(
      '/apps/my-app/chart/templates\n',
    );
  });

  it('appends missing entries and keeps existing content', () => {
    tree.write('.prettierignore', '# comment\n/dist\n\n/coverage');

    addToPrettierIgnore(tree, ['/dist', '/apps/my-app/chart/templates']);

    expect(tree.read('.prettierignore', 'utf8')).toBe(
      '# comment\n/dist\n\n/coverage\n/apps/my-app/chart/templates\n',
    );
  });

  it('does not duplicate entries that are already present', () => {
    tree.write('.prettierignore', '/dist\n/apps/my-app/chart/templates');

    addToPrettierIgnore(tree, ['/apps/my-app/chart/templates']);

    expect(tree.read('.prettierignore', 'utf8')).toBe(
      '/dist\n/apps/my-app/chart/templates',
    );
  });
});
