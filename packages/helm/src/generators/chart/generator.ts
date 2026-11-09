import path from 'node:path';

import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
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

  // Helm template syntax is not valid YAML, so prettier cannot format it.
  addToPrettierIgnore(tree, [`/${chartRoot}/templates`]);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default chartGenerator;
