import path from 'node:path';

import {
  formatFiles,
  generateFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { ChartGeneratorSchema } from './schema.d';

export async function chartGenerator(
  tree: Tree,
  options: ChartGeneratorSchema,
) {
  const project = readProjectConfiguration(tree, options.project);

  if (project.targets?.helm) {
    throw new Error(
      `Project ${options.project} already has a helm target. Please remove it before running this command.`,
    );
  }

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
          push: false,
          remote: 'oci://localhost:5000/helm-charts',
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

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default chartGenerator;
