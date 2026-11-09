import { readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator, VERSION_ACTIONS } from './generator';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should register the plugin', async () => {
    await initGenerator(tree, { skipFormat: true });

    expect(readNxJson(tree)?.plugins).toContain('@nx-extensions/helm');
  });

  it('should register the plugin with the registry options', async () => {
    await initGenerator(tree, {
      remote: 'oci://localhost:5000/charts',
      plainHttp: true,
      skipFormat: true,
    });

    expect(readNxJson(tree)?.plugins).toContainEqual({
      plugin: '@nx-extensions/helm',
      options: { remote: 'oci://localhost:5000/charts', plainHttp: true },
    });
  });

  it('should leave an existing registration alone', async () => {
    const plugins = [
      {
        plugin: '@nx-extensions/helm',
        options: { projectName: '{chartName}' },
      },
    ];
    updateNxJson(tree, { ...readNxJson(tree), plugins });

    await initGenerator(tree, {
      remote: 'oci://localhost:5000/charts',
      skipFormat: true,
    });

    expect(readNxJson(tree)?.plugins).toEqual(plugins);
  });

  it('should not register the plugin twice', async () => {
    updateNxJson(tree, {
      ...readNxJson(tree),
      plugins: ['@nx-extensions/helm'],
    });

    await initGenerator(tree, { skipFormat: true });

    expect(readNxJson(tree)?.plugins).toEqual(['@nx-extensions/helm']);
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
