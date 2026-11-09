import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { parse } from 'yaml';

import { dependencyGenerator } from './generator';
import { DependencyGeneratorSchema } from './schema';
import { chartGenerator } from '../chart/generator';

const chartYaml = 'apps/test-project/chart/Chart.yaml';

const options: DependencyGeneratorSchema = {
  project: 'test-project',
  chartName: 'nginx',
  chartVersion: '18.1.7',
  repository: 'https://charts.example.com',
  repositoryName: 'example',
  skipFormat: true,
};

describe('dependency generator', () => {
  let tree: Tree;

  const repositories = () =>
    readProjectConfiguration(tree, 'test-project').targets?.['helm']?.options
      ?.repositories;
  const chartDependencies = () =>
    parse(tree.read(chartYaml, 'utf8') ?? '').dependencies;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test-project', {
      root: 'apps/test-project',
    });
    await chartGenerator(tree, {
      project: 'test-project',
      name: 'test-chart',
      skipFormat: true,
    });
  });

  it('should add the repository to the project configuration', async () => {
    await dependencyGenerator(tree, options);

    expect(repositories()).toEqual([
      { name: 'example', url: 'https://charts.example.com' },
    ]);
  });

  it('should add the dependency to Chart.yaml', async () => {
    await dependencyGenerator(tree, options);

    expect(chartDependencies()).toEqual([
      {
        name: 'nginx',
        version: '18.1.7',
        repository: 'https://charts.example.com',
      },
    ]);
  });

  it('should update an existing dependency and save Chart.yaml', async () => {
    await dependencyGenerator(tree, options);
    await dependencyGenerator(tree, {
      ...options,
      chartVersion: '19.0.0',
      repository: 'https://mirror.example.com',
    });

    expect(chartDependencies()).toEqual([
      {
        name: 'nginx',
        version: '19.0.0',
        repository: 'https://mirror.example.com',
      },
    ]);
  });

  it('should not duplicate a repository with the same name', async () => {
    await dependencyGenerator(tree, options);
    await dependencyGenerator(tree, {
      ...options,
      chartName: 'redis',
      repository: 'https://mirror.example.com',
    });

    expect(repositories()).toEqual([
      { name: 'example', url: 'https://mirror.example.com' },
    ]);
    expect(chartDependencies()).toHaveLength(2);
  });

  it('should work when the helm target has no repositories option', async () => {
    const project = readProjectConfiguration(tree, 'test-project');
    delete project.targets?.['helm']?.options?.repositories;
    updateProjectConfiguration(tree, 'test-project', project);

    await dependencyGenerator(tree, options);

    expect(repositories()).toEqual([
      { name: 'example', url: 'https://charts.example.com' },
    ]);
  });

  it('should keep comments in Chart.yaml', async () => {
    tree.write(
      chartYaml,
      `${tree.read(chartYaml, 'utf8')}# keep this comment\n`,
    );

    await dependencyGenerator(tree, options);

    expect(tree.read(chartYaml, 'utf8')).toContain('# keep this comment');
  });

  it('should reject a chartFolder outside the project root', async () => {
    const project = readProjectConfiguration(tree, 'test-project');
    if (project.targets?.['helm']) {
      project.targets['helm'].options.chartFolder = 'apps/other/chart';
    }
    updateProjectConfiguration(tree, 'test-project', project);

    await expect(dependencyGenerator(tree, options)).rejects.toThrow(
      'must be inside the project root',
    );
  });

  it('should reject credentials in the repository URL', async () => {
    await expect(
      dependencyGenerator(tree, {
        ...options,
        repository: 'https://ci:s3cret@charts.example.com',
      }),
    ).rejects.toThrow('contains credentials');
  });

  it('should require a helm target', async () => {
    addProjectConfiguration(tree, 'no-helm', { root: 'apps/no-helm' });

    await expect(
      dependencyGenerator(tree, { ...options, project: 'no-helm' }),
    ).rejects.toThrow('does not have a helm target');
  });
});
