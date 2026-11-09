import path from 'node:path';

import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { addToPrettierIgnore, isPathInside } from '@nx-extensions/core';

import { ChartGeneratorSchema } from './schema.d';

/**
 * Turns a name into a valid chart name. Helm uses the chart name in resource
 * names, and Services need a DNS-1035 label: lowercase alphanumerics and `-`.
 *
 * @param {string} name
 * @returns {string}
 */
export function toChartName(name: string): string {
  const chartName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!chartName) {
    throw new Error(`Cannot derive a valid chart name from "${name}".`);
  }

  return chartName;
}

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

  const chartName = toChartName(options.name);
  if (chartName !== options.name) {
    logger.warn(
      `"${options.name}" is not a valid chart name, using "${chartName}" instead.`,
    );
  }

  const chartFolder = options.chartFolder ?? 'chart';
  const chartRoot = joinPathFragments(project.root, chartFolder);
  if (path.isAbsolute(chartFolder) || !isPathInside(project.root, chartRoot)) {
    throw new Error(
      `chartFolder "${chartFolder}" must be a path inside the project root "${project.root}".`,
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
          chartFolder: chartRoot,
          outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
          push: false,
          updateDependencies: false,
          buildDependencies: true,
          repositories: [],
        },
      },
    },
  });

  generateFiles(tree, path.join(__dirname, 'files', 'chart'), chartRoot, {
    ...options,
    name: chartName,
  });

  // Helm template syntax is not valid YAML, so formatters can't parse it
  const templates = joinPathFragments(chartRoot, 'templates');
  addToPrettierIgnore(tree, [`/${templates}`]);

  if (!options.skipFormat) {
    // Older devkits' formatFiles doesn't read the .prettierignore in the
    // tree, so keep the templates out of the tree while formatting
    const held = holdBack(tree, templates);
    await formatFiles(tree);
    for (const [file, content] of held) {
      tree.write(file, content);
    }
  }
}

function holdBack(tree: Tree, folder: string): Map<string, Buffer> {
  const held = new Map<string, Buffer>();
  visitNotIgnoredFiles(tree, folder, (file) => {
    const content = tree.read(file);
    if (content) {
      held.set(file, content);
      tree.delete(file);
    }
  });
  return held;
}

export default chartGenerator;
