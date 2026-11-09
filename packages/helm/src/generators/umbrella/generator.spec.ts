import {
  addProjectConfiguration,
  createProjectGraphAsync,
  readJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { prompt } from 'enquirer';
import { parse } from 'yaml';

import { umbrellaGenerator } from './generator';
import { chartProjectGraph } from '../../testing/chart-graph';
import { registerHelmPlugin } from '../../utils/workspace';
import { chartGenerator } from '../chart/generator';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(),
}));
jest.mock('enquirer', () => ({ prompt: jest.fn() }));

const chartRoots = ['apps/frontend/chart', 'apps/backend/chart'];

describe('umbrella generator', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);
    for (const app of ['frontend', 'backend']) {
      addProjectConfiguration(tree, app, { root: `apps/${app}` });
      await chartGenerator(tree, { name: app, project: app, skipFormat: true });
    }
    jest
      .mocked(createProjectGraphAsync)
      .mockResolvedValue(chartProjectGraph(tree, chartRoots));
  });

  const chart = (root = 'charts/platform') =>
    parse(tree.read(`${root}/Chart.yaml`, 'utf8') ?? '');

  it('should add the charts as file:// subcharts at their versions', async () => {
    await umbrellaGenerator(tree, {
      name: 'platform',
      charts: ['frontend-chart', 'backend-chart'],
      skipFormat: true,
    });

    expect(chart()).toEqual({
      apiVersion: 'v2',
      name: 'platform',
      description: 'Deploys frontend, backend together',
      type: 'application',
      version: '0.1.0',
      dependencies: [
        {
          name: 'frontend',
          version: '0.1.0',
          repository: 'file://../../apps/frontend/chart',
          condition: 'frontend.enabled',
        },
        {
          name: 'backend',
          version: '0.1.0',
          repository: 'file://../../apps/backend/chart',
          condition: 'backend.enabled',
        },
      ],
    });
  });

  it('should add a values section for each subchart', async () => {
    await umbrellaGenerator(tree, {
      name: 'platform',
      charts: ['frontend-chart', 'backend-chart'],
      skipFormat: true,
    });

    expect(
      parse(tree.read('charts/platform/values.yaml', 'utf8') ?? ''),
    ).toEqual({
      global: {},
      frontend: { enabled: true },
      backend: { enabled: true },
    });
    expect(tree.exists('charts/platform/.helmignore')).toBe(true);
    // helm lint warns about a chart without templates
    expect(tree.exists('charts/platform/templates/NOTES.txt')).toBe(true);
    expect(tree.read('.gitignore', 'utf8')).toContain(
      '/charts/platform/charts/*.tgz\n',
    );
  });

  it('should take a comma-separated list and a directory', async () => {
    await umbrellaGenerator(tree, {
      name: 'platform',
      charts: 'frontend-chart, backend-chart' as unknown as string[],
      directory: 'deploy/platform',
      skipFormat: true,
    });

    expect(chart('deploy/platform').dependencies).toHaveLength(2);
  });

  it('should only publish the umbrella with publishSubcharts false', async () => {
    await umbrellaGenerator(tree, {
      name: 'platform',
      charts: ['frontend-chart', 'backend-chart'],
      publishSubcharts: false,
      skipFormat: true,
    });

    for (const [root, name] of [
      ['apps/frontend/chart', 'frontend-chart'],
      ['apps/backend/chart', 'backend-chart'],
    ]) {
      expect(readJson(tree, `${root}/project.json`)).toEqual({
        name,
        targets: { 'nx-release-publish': { options: { publish: false } } },
      });
    }
  });

  it('should keep publishing the subcharts by default', async () => {
    await umbrellaGenerator(tree, {
      name: 'platform',
      charts: ['frontend-chart'],
      skipFormat: true,
    });

    expect(tree.exists('apps/frontend/chart/project.json')).toBe(false);
  });

  it('should need the plugin', async () => {
    tree = createTreeWithEmptyWorkspace();

    await expect(
      umbrellaGenerator(tree, { name: 'platform', charts: ['frontend-chart'] }),
    ).rejects.toThrow('nx g @nx-extensions/helm:init');
  });

  it('should reject an unknown chart project', async () => {
    await expect(
      umbrellaGenerator(tree, {
        name: 'platform',
        charts: ['nope-chart'],
        skipFormat: true,
      }),
    ).rejects.toThrow('Cannot find a project named "nope-chart"');
  });

  it.each(['../outside', '/etc/platform', '.'])(
    'should reject the directory %s',
    async (directory) => {
      await expect(
        umbrellaGenerator(tree, {
          name: 'platform',
          charts: ['frontend-chart'],
          directory,
          skipFormat: true,
        }),
      ).rejects.toThrow('must be a folder inside the workspace');
    },
  );

  it('should not overwrite an existing chart', async () => {
    await expect(
      umbrellaGenerator(tree, {
        name: 'platform',
        charts: ['backend-chart'],
        directory: 'apps/frontend/chart',
        skipFormat: true,
      }),
    ).rejects.toThrow('already has a Chart.yaml');
  });

  describe('without charts', () => {
    const interactive = process.env.NX_INTERACTIVE;
    afterEach(() => {
      process.env.NX_INTERACTIVE = interactive;
      jest.mocked(prompt).mockReset();
    });

    it('should let the user pick the chart projects', async () => {
      process.env.NX_INTERACTIVE = 'true';
      jest.mocked(prompt).mockResolvedValue({ charts: ['frontend-chart'] });

      await umbrellaGenerator(tree, { name: 'platform', skipFormat: true });

      expect(prompt).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'multiselect',
          choices: ['backend-chart', 'frontend-chart'],
        }),
      );
      expect(chart().dependencies).toEqual([
        expect.objectContaining({ name: 'frontend' }),
      ]);
    });

    it('should ask for charts when not interactive', async () => {
      process.env.NX_INTERACTIVE = 'false';

      await expect(
        umbrellaGenerator(tree, { name: 'platform', skipFormat: true }),
      ).rejects.toThrow('--charts=');
      expect(prompt).not.toHaveBeenCalled();
    });
  });
});
