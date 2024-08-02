import {
  generateFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import * as path from 'path';
import { ChartGeneratorSchema } from './schema';
import { DEFAULT_OPTIONS } from './constants';

export async function chartGenerator(
  tree: Tree,
  options: ChartGeneratorSchema
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
    path.join(__dirname, 'files', 'chart'),
    path.join(project.root, options.chartFolder),
    options
  );
}

export default chartGenerator;
