import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './convert-to-chart-projects';
import { defaultPluginOptions } from '../../plugins/plugin';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: jest.fn(),
}));

describe('convert-to-chart-projects migration', () => {
  let tree: Tree;

  /** An app with a chart and the helm target the 1.x chart generator added. */
  const addApp = async (name: string, helm: Record<string, unknown> = {}) => {
    tree.write(
      `apps/${name}/chart/Chart.yaml`,
      `apiVersion: v2\nname: ${name}\nversion: 0.1.0\n`,
    );
    addProjectConfiguration(tree, name, {
      root: `apps/${name}`,
      targets: {
        helm: {
          executor: '@nx-extensions/helm:package',
          outputs: ['{options.outputFolder}'],
          options: {
            chartFolder: `apps/${name}/chart`,
            outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
            push: false,
            repositories: [],
            ...helm,
          },
        },
      },
    });
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove the helm target and register the plugin', async () => {
    await addApp('frontend');

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'frontend').targets?.['helm'],
    ).toBeUndefined();
    expect(readNxJson(tree)?.plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx-extensions/helm' }),
    );
    // The generated defaults are what the plugin infers
    expect(tree.exists('apps/frontend/chart/project.json')).toBe(false);
  });

  it('should move a shared remote to the plugin options', async () => {
    const remote = {
      push: true,
      remote: 'oci://localhost:5000/charts',
      plainHttp: true,
    };
    await addApp('frontend', remote);
    await addApp('backend', remote);

    await update(tree);

    expect(readNxJson(tree)?.plugins).toContainEqual({
      plugin: '@nx-extensions/helm',
      options: {
        ...defaultPluginOptions,
        remote: 'oci://localhost:5000/charts',
        plainHttp: true,
      },
    });
    expect(tree.exists('apps/frontend/chart/project.json')).toBe(false);
  });

  it('should keep differing options in a project.json at the chart root', async () => {
    const repositories = [
      { name: 'example', url: 'https://charts.example.com' },
    ];
    await addApp('frontend', {
      push: true,
      remote: 'oci://localhost:5000/charts',
      repositories,
      updateDependencies: true,
      outputFolder: 'build/{projectRoot}',
    });
    await addApp('backend');

    await update(tree);

    expect(readNxJson(tree)?.plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx-extensions/helm' }),
    );
    const build = { repositories, outputFolder: 'build/apps/frontend' };
    expect(readJson(tree, 'apps/frontend/chart/project.json')).toEqual({
      name: 'frontend-chart',
      targets: {
        'helm-package': { options: { ...build, updateDependencies: true } },
        'helm-push': {
          options: {
            ...build,
            updateDependencies: true,
            remote: 'oci://localhost:5000/charts',
          },
        },
        'nx-release-publish': {
          options: { ...build, remote: 'oci://localhost:5000/charts' },
        },
      },
    });
  });

  it('should use the target names of an existing registration', async () => {
    await addApp('frontend', { updateDependencies: true });
    updateNxJson(tree, {
      ...readNxJson(tree),
      plugins: [
        {
          plugin: '@nx-extensions/helm',
          options: { packageTargetName: 'package', pushTargetName: 'push' },
        },
      ],
    });

    await update(tree);

    expect(
      Object.keys(readJson(tree, 'apps/frontend/chart/project.json').targets),
    ).toEqual(['package', 'push']);
  });

  it('should register the plugin when there is nothing to convert', async () => {
    await update(tree);

    expect(readNxJson(tree)?.plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx-extensions/helm' }),
    );
  });

  it('should leave targets with configurations alone', async () => {
    await addApp('frontend');
    const project = readProjectConfiguration(tree, 'frontend');
    updateProjectConfiguration(tree, 'frontend', {
      ...project,
      targets: {
        helm: { ...project.targets?.['helm'], configurations: { prod: {} } },
      },
    });

    await update(tree);

    expect(
      readProjectConfiguration(tree, 'frontend').targets?.['helm'],
    ).toBeDefined();
    expect(readNxJson(tree)?.plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx-extensions/helm' }),
    );
  });
});
