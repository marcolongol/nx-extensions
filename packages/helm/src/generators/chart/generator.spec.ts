import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { DEFAULT_OPTIONS } from './constants';

import { chartGenerator } from './generator';
import { ChartGeneratorSchema } from './schema';

describe('chart generator', () => {
  let tree: Tree;
  const options: ChartGeneratorSchema = {
    ...DEFAULT_OPTIONS,
    name: 'test-chart',
    project: 'test-project',
  };

  beforeAll(async () => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, options.project, {
      root: `'${options.project}'`,
    });

    await chartGenerator(tree, options);
  });

  it('should run successfully', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(projectConfig).toBeDefined();
  });

  it('should create the chart', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(tree.exists(`${projectConfig.root}/chart/Chart.yaml`)).toBe(true);
  });

  it('should update the project configuration', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(projectConfig.targets['helm']).toBeDefined();
  });
});
