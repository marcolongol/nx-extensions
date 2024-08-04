import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { chartGenerator } from './generator';
import { ChartGeneratorSchema } from './schema.d';

describe('chart generator', () => {
  let tree: Tree;
  let options: ChartGeneratorSchema;

  beforeAll(async () => {
    tree = createTreeWithEmptyWorkspace();

    options = {
      name: 'test-chart',
      project: 'test-project',
      chartFolder: 'chart',
    };

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

  it('should create the chart in a custom folder', async () => {
    options = { ...options, chartFolder: 'custom-folder' };
    await chartGenerator(tree, options);
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(tree.exists(`${projectConfig.root}/custom-folder/Chart.yaml`)).toBe(
      true,
    );
  });

  it('should update the project configuration', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(projectConfig.targets['helm']).toBeDefined();
    expect(projectConfig.targets['helm'].executor).toBe(
      '@nx-extensions/helm:package',
    );
    expect(projectConfig.targets['helm'].outputs).toEqual([
      '{options.outputFolder}',
    ]);
    expect(projectConfig.targets['helm'].options).toEqual({
      chartFolder: `${projectConfig.root}/${options.chartFolder}`,
      outputFolder: '{workspaceRoot}/charts/{projectRoot}',
      push: false,
      remote: 'oci://localhost:5000/helm-charts',
    });
  });
});
