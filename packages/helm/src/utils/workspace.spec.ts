import {
  addProjectConfiguration,
  createProjectGraphAsync,
  readJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import {
  addToGitIgnore,
  findProjectRoot,
  readHelmPluginOptions,
  registerHelmPlugin,
  updateChartTargetOptions,
} from './workspace';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(),
}));

describe('workspace utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should read the plugin options', () => {
    expect(readHelmPluginOptions(tree)).toBeNull();
    registerHelmPlugin(tree);
    expect(readHelmPluginOptions(tree)).toEqual({});
  });

  it('should register the plugin once', () => {
    expect(registerHelmPlugin(tree, { remote: 'oci://r/charts' })).toBe(true);
    expect(registerHelmPlugin(tree)).toBe(false);
    expect(readHelmPluginOptions(tree)).toEqual({ remote: 'oci://r/charts' });
  });

  it('should find the root of an inferred project in the graph', async () => {
    addProjectConfiguration(tree, 'app', { root: 'apps/app' });
    jest.mocked(createProjectGraphAsync).mockResolvedValue({
      nodes: {
        'app-chart': {
          name: 'app-chart',
          type: 'lib',
          data: { root: 'apps/app/chart' },
        },
      },
      dependencies: {},
    });

    await expect(findProjectRoot(tree, 'app')).resolves.toBe('apps/app');
    await expect(findProjectRoot(tree, 'app-chart')).resolves.toBe(
      'apps/app/chart',
    );
    await expect(findProjectRoot(tree, 'nope')).rejects.toThrow(
      'Cannot find a project named "nope"',
    );
  });

  it('should only add missing .gitignore entries', () => {
    tree.write('.gitignore', 'node_modules');
    addToGitIgnore(tree, ['node_modules', '/a/charts/*.tgz']);
    addToGitIgnore(tree, ['/a/charts/*.tgz']);

    expect(tree.read('.gitignore', 'utf8')).toBe(
      'node_modules\n/a/charts/*.tgz\n',
    );
  });

  it('should name the chart project in a new project.json', () => {
    tree.write('a/Chart.yaml', 'name: a\nversion: 1.0.0\n');
    registerHelmPlugin(tree, { projectName: 'chart-{chartName}' });

    updateChartTargetOptions(tree, 'a', { 'helm-package': {} });

    expect(readJson(tree, 'a/project.json').name).toBe('chart-a');
  });

  it('should merge target options into a chart project.json', () => {
    tree.write('a/Chart.yaml', 'name: a\nversion: 1.0.0\n');
    writeJson(tree, 'a/project.json', {
      tags: ['x'],
      targets: { 'helm-package': { options: { updateDependencies: true } } },
    });

    updateChartTargetOptions(tree, 'a', {
      'helm-package': { repositories: [] },
      'nx-release-publish': { publish: false },
    });

    expect(readJson(tree, 'a/project.json')).toEqual({
      name: 'a-chart',
      tags: ['x'],
      targets: {
        'helm-package': {
          options: { updateDependencies: true, repositories: [] },
        },
        'nx-release-publish': { options: { publish: false } },
      },
    });
  });
});
