import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import yaml from 'js-yaml';

import { dependencyGenerator } from './generator';
import { DependencyGeneratorSchema } from './schema';
import { chartGenerator } from '../chart/generator';
import { ChartGeneratorSchema } from '../chart/schema';

describe('dependency generator', () => {
  let tree: Tree;
  let chartOptions: ChartGeneratorSchema;
  let dependencyOptions: DependencyGeneratorSchema;

  beforeAll(async () => {
    tree = createTreeWithEmptyWorkspace();

    chartOptions = {
      project: 'test-project',
      name: 'test-chart',
      chartFolder: 'chart',
      format: false,
    };

    dependencyOptions = {
      project: 'test-project',
      chartName: 'nginx',
      chartVersion: '18.7.1',
      repository: 'https://charts.bitnami.com/bitnami',
      repositoryName: 'bitnami',
      format: false,
    };

    addProjectConfiguration(tree, chartOptions.project, {
      root: `'${chartOptions.project}'`,
    });

    await chartGenerator(tree, chartOptions);

    await dependencyGenerator(tree, dependencyOptions);
  });

  it('should run successfully', async () => {
    const config = readProjectConfiguration(tree, 'test-project');
    expect(config).toBeDefined();
  });

  it('should add the dependency to project configuration', async () => {
    const config = readProjectConfiguration(tree, 'test-project');
    expect(config.targets?.helm?.options?.dependencies?.repositories).toEqual([
      {
        name: 'bitnami',
        url: 'https://charts.bitnami.com/bitnami',
      },
    ]);
  });

  it('should add the dependency to Chart.yaml', async () => {
    const config = readProjectConfiguration(tree, 'test-project');
    const chartFolder = config.targets?.helm?.options?.chartFolder;
    const chartContents = yaml.load(
      tree.read(`${chartFolder}/Chart.yaml`, 'utf8').toString(),
    ) as {
      dependencies: { name: string; version: string; repository: string }[];
    };

    console.log(chartContents);

    expect(chartContents.dependencies).toEqual([
      {
        name: 'nginx',
        version: '18.7.1',
        repository: 'https://charts.bitnami.com/bitnami',
      },
    ]);
  });
});
