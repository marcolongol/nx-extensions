import {
  addProjectConfiguration,
  createProjectGraphAsync,
  readJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { parse } from 'yaml';

import { dependencyGenerator } from './generator';
import { DependencyGeneratorSchema } from './schema';
import { chartProjectGraph } from '../../testing/chart-graph';
import { registerHelmPlugin } from '../../utils/workspace';
import { chartGenerator } from '../chart/generator';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest.fn(),
}));

const platform = 'charts/platform/Chart.yaml';

const nginx: DependencyGeneratorSchema = {
  project: 'platform-chart',
  chartName: 'nginx',
  chartVersion: '18.1.7',
  repository: 'https://charts.example.com',
  repositoryName: 'example',
  skipFormat: true,
};

describe('dependency generator', () => {
  let tree: Tree;
  const dependencies = () =>
    parse(tree.read(platform, 'utf8') ?? '').dependencies;
  const repositories = (target = 'helm-package') =>
    readJson(tree, 'charts/platform/project.json').targets[target].options
      .repositories;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);
    addProjectConfiguration(tree, 'frontend', { root: 'apps/frontend' });
    await chartGenerator(tree, {
      name: 'frontend',
      project: 'frontend',
      skipFormat: true,
    });
    tree.write(platform, 'apiVersion: v2\nname: platform\nversion: 1.0.0\n');
    jest
      .mocked(createProjectGraphAsync)
      .mockResolvedValue(
        chartProjectGraph(tree, ['apps/frontend/chart', 'charts/platform']),
      );
  });

  it('should add a chart project as a file:// dependency', async () => {
    await dependencyGenerator(tree, {
      project: 'platform-chart',
      chartProject: 'frontend-chart',
      skipFormat: true,
    });

    expect(dependencies()).toEqual([
      {
        name: 'frontend',
        version: '0.1.0',
        repository: 'file://../../apps/frontend/chart',
      },
    ]);
    expect(tree.exists('charts/platform/project.json')).toBe(false);
  });

  it('should add an oci:// dependency without a repository entry', async () => {
    await dependencyGenerator(tree, {
      project: 'platform-chart',
      chartName: 'redis',
      chartVersion: '20.0.0',
      repository: 'oci://registry-1.docker.io/bitnamicharts',
      skipFormat: true,
    });

    expect(dependencies()).toHaveLength(1);
    expect(tree.exists('charts/platform/project.json')).toBe(false);
  });

  it('should add https:// repositories to the chart targets', async () => {
    await dependencyGenerator(tree, nginx);

    expect(dependencies()).toEqual([
      {
        name: 'nginx',
        version: '18.1.7',
        repository: 'https://charts.example.com',
      },
    ]);
    const options = {
      options: {
        repositories: [{ name: 'example', url: 'https://charts.example.com' }],
      },
    };
    expect(readJson(tree, 'charts/platform/project.json')).toEqual({
      name: 'platform-chart',
      targets: {
        'helm-package': options,
        'helm-push': options,
        'nx-release-publish': options,
      },
    });
  });

  it('should update an existing dependency and repository', async () => {
    await dependencyGenerator(tree, nginx);
    await dependencyGenerator(tree, {
      ...nginx,
      chartVersion: '19.0.0',
      repository: 'https://mirror.example.com',
    });

    expect(dependencies()).toEqual([
      {
        name: 'nginx',
        version: '19.0.0',
        repository: 'https://mirror.example.com',
      },
    ]);
    expect(repositories('nx-release-publish')).toEqual([
      { name: 'example', url: 'https://mirror.example.com' },
    ]);
  });

  it('should keep comments in Chart.yaml', async () => {
    tree.write(platform, `${tree.read(platform, 'utf8')}# keep this comment\n`);

    await dependencyGenerator(tree, nginx);

    expect(tree.read(platform, 'utf8')).toContain('# keep this comment');
  });

  it('should need a repositoryName for https:// repositories', async () => {
    await expect(
      dependencyGenerator(tree, { ...nginx, repositoryName: undefined }),
    ).rejects.toThrow('needs a repositoryName');
  });

  it('should reject credentials in the repository URL', async () => {
    await expect(
      dependencyGenerator(tree, {
        ...nginx,
        repository: 'https://ci:s3cret@charts.example.com',
      }),
    ).rejects.toThrow('contains credentials');
  });

  it('should need a chart to depend on', async () => {
    await expect(
      dependencyGenerator(tree, {
        project: 'platform-chart',
        skipFormat: true,
      }),
    ).rejects.toThrow('or chartProject');
  });

  it('should not let a chart depend on itself', async () => {
    await expect(
      dependencyGenerator(tree, {
        project: 'platform-chart',
        chartProject: 'platform-chart',
        skipFormat: true,
      }),
    ).rejects.toThrow("can't depend on itself");
  });

  it('should only add dependencies to chart projects', async () => {
    await expect(
      dependencyGenerator(tree, { ...nginx, project: 'frontend' }),
    ).rejects.toThrow('is not a chart project');
  });
});
