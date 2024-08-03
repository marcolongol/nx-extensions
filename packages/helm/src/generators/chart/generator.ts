import path from 'node:path';

import {
  generateFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { DEFAULT_OPTIONS } from './constants';
import { ChartGeneratorSchema } from './schema.d';

export async function chartGenerator(
  tree: Tree,
  options: ChartGeneratorSchema,
) {
  options = { ...DEFAULT_OPTIONS, ...options };

  const project = readProjectConfiguration(tree, options.project);

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      helm: {
        executor: '@nx-extensions/helm:package',
        outputs: ['{options.outputFolder}'],
        options: {
          chartFolder: `${project.root}/${options.chartFolder}`,
          outputFolder: '{workspaceRoot}/charts/{projectRoot}',
          publish: false,
        },
      },
    },
  });

  generateFiles(
    tree,
    // eslint-disable-next-line unicorn/prefer-module
    path.join(__dirname, 'files', 'chart'),
    path.join(project.root, options.chartFolder),
    options,
  );
}

export default chartGenerator;
