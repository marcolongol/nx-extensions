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
      skipFormat: true,
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

  it('should throw an error if the project already has a helm target', async () => {
    try {
      await chartGenerator(tree, options);
    } catch (error) {
      expect(error.message).toBe(
        `Project ${options.project} already has a helm target. Please remove it before running this command.`,
      );
    }
  });

  it('should create the chart in a custom folder', async () => {
    options = {
      ...options,
      project: 'test-project-custom-folder',
      chartFolder: 'custom-folder',
    };
    addProjectConfiguration(tree, options.project, {
      root: `'${options.project}'`,
    });
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
