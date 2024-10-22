import {
  addProjectConfiguration,
  ExecutorContext,
  Tree,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

import { PackageExecutorSchema } from './schema.d';
import chartGenerator from '../../generators/chart/generator';
import { ChartGeneratorSchema } from '../../generators/chart/schema.d';

const options: PackageExecutorSchema = {
  chartFolder: 'chart',
  outputFolder: 'chart',
  publish: false,
};

const context: ExecutorContext = {
  root: '',
  projectsConfigurations: {
    version: 1,
    projects: {},
  },
  nxJsonConfiguration: {},
  projectGraph: {
    nodes: {},
    dependencies: {},
  },
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Package Executor', () => {
  let tree: Tree;
  let generatorOptions: ChartGeneratorSchema;
  let packageOptions: PackageExecutorSchema;

  beforeAll(async () => {
    tree = createTreeWithEmptyWorkspace();

    generatorOptions = {
      name: 'test-chart',
      project: 'test-project',
      chartFolder: 'chart',
    };

    addProjectConfiguration(tree, generatorOptions.project, {
      root: `'${generatorOptions.project}'`,
    });

    await chartGenerator(tree, generatorOptions);

    const projectConfig = readProjectConfiguration(
      tree,
      generatorOptions.project,
    );

    packageOptions = projectConfig.targets['helm'].options;
    console.log(packageOptions);
  });

  it('can run', async () => {
    // TODO: Implement test
    // const output = await executor(options, context);
    // expect(output.success).toBe(true);
  });
});
