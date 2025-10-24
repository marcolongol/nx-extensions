import path from 'node:path';

import {
  formatFiles,
  generateFiles,
  logger,
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
          outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
          push: false,
          remote: 'oci://localhost:5000/helm-charts',
          dependencies: {
            update: true,
            build: true,
            repositories: [],
          },
        },
      },
    },
  });

  generateFiles(
    tree,
    path.join(__dirname, 'files', 'chart'),
    path.join(project.root, options.chartFolder),
    options,
  );

  if (options.format) {
    await formatFiles(tree);
  }

  // TODO: can we do this programmatically?
  logger.warn(
    `Add ${project.root}/${options.chartFolder} to .prettierignore to avoid Helm chart syntax errors.`,
  );
}

export default chartGenerator;
