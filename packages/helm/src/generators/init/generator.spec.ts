import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator, VERSION_ACTIONS } from './generator';
import { defaultPluginOptions } from '../../plugins/plugin';
import { readHelmPluginOptions } from '../../utils/workspace';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should register the plugin with the default options written out', async () => {
    await initGenerator(tree, { skipFormat: true });

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@nx-extensions/helm',
        options: {
          projectName: '{chartName}-chart',
          packageTargetName: 'helm-package',
          pushTargetName: 'helm-push',
          outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
          appVersion: 'none',
        },
      },
    ]);
  });

  it('should turn on appVersion tracking', async () => {
    await initGenerator(tree, { appVersion: 'project', skipFormat: true });

    expect(readNxJson(tree)?.plugins).toEqual([
      {
        plugin: '@nx-extensions/helm',
        options: { ...defaultPluginOptions, appVersion: 'project' },
      },
    ]);
  });

  it('should register the plugin with the registry options', async () => {
    await initGenerator(tree, {
      remote: 'oci://localhost:5000/charts',
      plainHttp: true,
      skipFormat: true,
    });

    expect(readNxJson(tree)?.plugins).toContainEqual({
      plugin: '@nx-extensions/helm',
      options: {
        ...defaultPluginOptions,
        remote: 'oci://localhost:5000/charts',
        plainHttp: true,
      },
    });
  });

  it('should set options on an existing registration', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      plugins: [
        '@nx/js',
        {
          plugin: '@nx-extensions/helm',
          options: { projectName: '{chartName}' },
          exclude: ['vendor/**'],
        },
      ],
    });

    await initGenerator(tree, { appVersion: 'project', skipFormat: true });

    expect(readNxJson(tree)?.plugins).toEqual([
      '@nx/js',
      {
        plugin: '@nx-extensions/helm',
        options: { projectName: '{chartName}', appVersion: 'project' },
        exclude: ['vendor/**'],
      },
    ]);
  });

  it('should not register the plugin twice', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      plugins: ['@nx-extensions/helm'],
    });

    await initGenerator(tree, { skipFormat: true });

    expect(readNxJson(tree)?.plugins).toEqual(['@nx-extensions/helm']);
  });

  it("should not turn off appVersion tracking with the prompt's default", async () => {
    await initGenerator(tree, { appVersion: 'project', skipFormat: true });
    await initGenerator(tree, {
      appVersion: 'none',
      release: true,
      skipFormat: true,
    });

    expect(readHelmPluginOptions(tree)?.appVersion).toBe('project');
  });

  it('should not add a release group by default', async () => {
    await initGenerator(tree, { skipFormat: true });

    expect(readNxJson(tree)?.release).toBeUndefined();
  });

  it('should add a charts release group with release', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      release: { groups: { apps: { projects: ['frontend'] } } },
    });

    await initGenerator(tree, { release: true, skipFormat: true });

    expect(readNxJson(tree)?.release?.groups).toEqual({
      apps: { projects: ['frontend'] },
      charts: {
        projects: ['tag:helm-chart'],
        projectsRelationship: 'independent',
        version: { versionActions: VERSION_ACTIONS },
      },
    });
  });

  it('should keep an existing charts release group', async () => {
    const charts = { projects: ['my-chart'] };
    updateNxJson(tree, {
      ...readNxJson(tree),
      release: { groups: { charts } },
    });

    await initGenerator(tree, { release: true, skipFormat: true });

    expect(readNxJson(tree)?.release?.groups).toEqual({ charts });
  });

  it("should not add a group next to release.projects, which can't be combined", async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      release: { projects: ['lib'] },
    });

    await initGenerator(tree, { release: true, skipFormat: true });

    expect(readNxJson(tree)?.release).toEqual({ projects: ['lib'] });
  });
});
