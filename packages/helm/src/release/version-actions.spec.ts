import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { ProjectGraph, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { runCommand } from '@nx-extensions/core';

import HelmVersionActions, {
  afterAllProjectsVersioned,
} from './version-actions';

jest.mock('@nx-extensions/core', () => ({
  ...jest.requireActual('@nx-extensions/core'),
  runCommand: jest.fn(),
}));

const roots: Record<string, string> = {
  frontend: 'apps/frontend',
  'frontend-chart': 'apps/frontend/chart',
  'backend-chart': 'apps/backend/chart',
  'platform-chart': 'charts/platform',
};

const projectGraph = {
  nodes: Object.fromEntries(
    Object.entries(roots).map(([name, root]) => [
      name,
      { name, type: 'lib', data: { root } },
    ]),
  ),
  dependencies: {},
} as unknown as ProjectGraph;

const platformChart = `apiVersion: v2
name: platform
# Bumped by nx release
version: 1.4.0
dependencies:
  - name: frontend
    version: 2.1.0
    repository: file://../../apps/frontend/chart
  - name: backend
    version: ^3.0.2
    repository: oci://ghcr.io/my-org/charts
  - name: redis
    version: ">=20.0.0"
    repository: oci://registry-1.docker.io/bitnamicharts
`;

describe('HelmVersionActions', () => {
  let tree: Tree;

  const actionsFor = async (project: string) => {
    const actions = new HelmVersionActions(
      { name: 'charts' } as never,
      projectGraph.nodes[project],
      {
        manifestRootsToUpdate: [],
        preserveLocalDependencyProtocols: false,
      } as never,
    );
    await actions.init(tree);
    return actions;
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('apps/frontend/project.json', '{}');
    tree.write(
      'apps/frontend/chart/Chart.yaml',
      'apiVersion: v2\nname: frontend\nversion: 2.1.0\nappVersion: "1.0.0"\n',
    );
    tree.write(
      'apps/backend/chart/Chart.yaml',
      'apiVersion: v2\nname: backend\nversion: 3.0.2\n',
    );
    tree.write('charts/platform/Chart.yaml', platformChart);
  });

  it('updates Chart.yaml in the chart folder by default', async () => {
    const actions = await actionsFor('platform-chart');

    expect(actions.manifestsToUpdate).toEqual([
      expect.objectContaining({ manifestPath: 'charts/platform/Chart.yaml' }),
    ]);
    expect(actions.validManifestFilenames).toEqual(['Chart.yaml']);
    expect(actions.excludeManifestsFromFormatting).toBe(true);
  });

  it('reads the current version from Chart.yaml', async () => {
    const actions = await actionsFor('platform-chart');

    await expect(
      actions.readCurrentVersionFromSourceManifest(tree),
    ).resolves.toEqual({
      currentVersion: '1.4.0',
      manifestPath: 'charts/platform/Chart.yaml',
    });
    await expect(actions.readCurrentVersionFromRegistry()).resolves.toBeNull();
  });

  it('writes the new version and keeps comments and formatting', async () => {
    const actions = await actionsFor('platform-chart');

    await actions.updateProjectVersion(tree, '1.5.0');

    expect(tree.read('charts/platform/Chart.yaml', 'utf8')).toBe(
      platformChart.replace('version: 1.4.0', 'version: 1.5.0'),
    );
  });

  it('reads the versions of chart dependencies and of the deployed app', async () => {
    const umbrella = await actionsFor('platform-chart');
    const frontend = await actionsFor('frontend-chart');

    await expect(
      umbrella.readCurrentVersionOfDependency(
        tree,
        projectGraph,
        'backend-chart',
      ),
    ).resolves.toEqual({
      currentVersion: '^3.0.2',
      dependencyCollection: 'dependencies',
    });
    await expect(
      frontend.readCurrentVersionOfDependency(tree, projectGraph, 'frontend'),
    ).resolves.toEqual({
      currentVersion: '1.0.0',
      dependencyCollection: 'appVersion',
    });
  });

  it('updates chart dependencies, keeping ^ and ~ and leaving other ranges alone', async () => {
    const actions = await actionsFor('platform-chart');

    const logs = await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.2.0',
      'backend-chart': '3.1.0',
    });

    const chart = tree.read('charts/platform/Chart.yaml', 'utf8');
    expect(chart).toContain('  - name: frontend\n    version: 2.2.0\n');
    expect(chart).toContain('  - name: backend\n    version: ^3.1.0\n');
    expect(chart).toContain('    version: ">=20.0.0"\n');
    expect(chart).toContain('# Bumped by nx release');
    expect(logs).toHaveLength(2);
  });

  it('leaves Chart.yaml untouched when no dependency version changes', async () => {
    const actions = await actionsFor('platform-chart');

    const logs = await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.1.0',
    });

    expect(logs).toEqual([]);
    expect(tree.read('charts/platform/Chart.yaml', 'utf8')).toBe(platformChart);
  });

  it('notes dependencies with a range it does not update', async () => {
    tree.write(
      'charts/platform/Chart.yaml',
      platformChart.replace('version: 2.1.0', 'version: 2.x'),
    );
    const actions = await actionsFor('platform-chart');

    const logs = await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.2.0',
    });

    expect(logs).toEqual([
      expect.stringContaining('Left the frontend dependency at "2.x"'),
    ]);
  });

  it('sets appVersion from a dependency that is not a chart', async () => {
    const actions = await actionsFor('frontend-chart');

    await actions.updateProjectDependencies(tree, projectGraph, {
      frontend: '1.3.0',
    });

    // The existing quoting is kept
    expect(tree.read('apps/frontend/chart/Chart.yaml', 'utf8')).toContain(
      'appVersion: "1.3.0"',
    );
  });
});

describe('Chart.lock refresh', () => {
  let tree: Tree;
  let cwd: string;

  const actionsFor = async (project: string) => {
    const actions = new HelmVersionActions(
      { name: 'charts' } as never,
      projectGraph.nodes[project],
      {
        manifestRootsToUpdate: [],
        preserveLocalDependencyProtocols: false,
      } as never,
    );
    await actions.init(tree);
    return actions;
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/frontend/chart/Chart.yaml',
      'name: frontend\nversion: 2.1.0\n',
    );
    tree.write('charts/platform/Chart.yaml', platformChart);
    cwd = mkdtempSync(path.join(tmpdir(), 'helm-release-'));
    mkdirSync(path.join(cwd, 'charts/platform'), { recursive: true });
    writeFileSync(
      path.join(cwd, 'charts/platform/Chart.lock'),
      'digest: sha256:abc\n',
    );
    jest.mocked(runCommand).mockReset();
  });

  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  it('refreshes the lock of a chart whose dependencies changed', async () => {
    const actions = await actionsFor('platform-chart');
    await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.2.0',
    });

    const result = await afterAllProjectsVersioned(cwd, {
      rootVersionActionsOptions: { plainHttp: true },
    });

    expect(result).toEqual({
      changedFiles: ['charts/platform/Chart.lock'],
      deletedFiles: [],
    });
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith(
      'helm',
      [
        'dependency',
        'update',
        '--skip-refresh',
        '--plain-http',
        '--',
        'charts/platform',
      ],
      { cwd },
    );
  });

  it('leaves locks alone when no dependency changed', async () => {
    const actions = await actionsFor('platform-chart');
    await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.1.0',
    });

    const result = await afterAllProjectsVersioned(cwd, {});

    expect(result.changedFiles).toEqual([]);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('only reports the stale lock in a dry run', async () => {
    const actions = await actionsFor('platform-chart');
    await actions.updateProjectDependencies(tree, projectGraph, {
      'frontend-chart': '2.2.0',
    });

    const result = await afterAllProjectsVersioned(cwd, { dryRun: true });

    expect(result.changedFiles).toEqual(['charts/platform/Chart.lock']);
    expect(runCommand).not.toHaveBeenCalled();
  });
});
