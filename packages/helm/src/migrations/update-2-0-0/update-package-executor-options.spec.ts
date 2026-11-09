import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import update from './update-package-executor-options';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: jest.fn(),
}));

const helmOptions = (project: string, tree: Tree) =>
  readProjectConfiguration(tree, project).targets?.['helm'];

describe('update-package-executor-options', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('flattens dependencies and renames version', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        helm: {
          executor: '@nx-extensions/helm:package',
          options: {
            chartFolder: 'apps/my-app/chart',
            outputFolder: 'dist/charts/apps/my-app',
            version: '1.2.3',
            remote: 'oci://ghcr.io/me/charts',
            dependencies: {
              update: false,
              build: true,
              repositories: [{ name: 'example', url: 'https://example.com' }],
            },
          },
          configurations: {
            release: { version: '2.0.0', dependencies: { update: true } },
          },
        },
      },
    });

    await update(tree);

    expect(helmOptions('my-app', tree)).toEqual({
      executor: '@nx-extensions/helm:package',
      options: {
        chartFolder: 'apps/my-app/chart',
        outputFolder: 'dist/charts/apps/my-app',
        chartVersion: '1.2.3',
        remote: 'oci://ghcr.io/me/charts',
        updateDependencies: false,
        buildDependencies: true,
        repositories: [{ name: 'example', url: 'https://example.com' }],
      },
      configurations: {
        release: { chartVersion: '2.0.0', updateDependencies: true },
      },
    });
  });

  it('writes out the 1.x defaults so behaviour does not change', async () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        helm: {
          executor: '@nx-extensions/helm:package',
          options: { chartFolder: 'apps/my-app/chart', outputFolder: 'dist' },
        },
      },
    });

    await update(tree);

    expect(helmOptions('my-app', tree)?.options).toEqual({
      chartFolder: 'apps/my-app/chart',
      outputFolder: 'dist',
      updateDependencies: true,
      buildDependencies: false,
    });
  });

  it('leaves targets of other executors alone', async () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      targets: {
        helm: {
          executor: 'nx:run-commands',
          options: { version: '1.0.0', dependencies: { update: true } },
        },
      },
    });

    await update(tree);

    expect(helmOptions('my-lib', tree)?.options).toEqual({
      version: '1.0.0',
      dependencies: { update: true },
    });
  });

  it('migrates targetDefaults in both the object and array form', async () => {
    const nxJson = readNxJson(tree) ?? {};
    nxJson.targetDefaults = {
      '@nx-extensions/helm:package': {
        options: { dependencies: { build: true } },
      },
      helm: [
        {
          executor: '@nx-extensions/helm:package',
          options: { version: '1.0.0' },
        },
      ],
    };
    updateNxJson(tree, nxJson);

    await update(tree);

    expect(readNxJson(tree)?.targetDefaults).toEqual({
      '@nx-extensions/helm:package': {
        options: { buildDependencies: true },
      },
      helm: [
        {
          executor: '@nx-extensions/helm:package',
          options: { chartVersion: '1.0.0' },
        },
      ],
    });
  });
});
