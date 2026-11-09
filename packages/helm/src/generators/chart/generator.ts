import path from 'node:path';

import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { addToPrettierIgnore, isPathInside } from '@nx-extensions/core';

import { ChartGeneratorSchema } from './schema.d';
import {
  addToGitIgnore,
  chartProjectName,
  chartTargetNames,
  readHelmPluginOptions,
} from '../../utils/workspace';

/**
 * Turns a name into a valid chart name. Helm uses the chart name in resource
 * names, and Services need a DNS-1035 label: lowercase alphanumerics and `-`.
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

  // Without a name, the chart is named after the project, minus an npm scope
  const name = options.name ?? options.project.split('/').pop() ?? '';
  const chartName = toChartName(name);
  if (chartName !== name) {
    logger.warn(
      `"${name}" is not a valid chart name, using "${chartName}" instead.`,
    );
  }

  const chartFolder = options.chartFolder ?? 'chart';
  const chartRoot = joinPathFragments(project.root, chartFolder);
  if (path.isAbsolute(chartFolder) || !isPathInside(project.root, chartRoot)) {
    throw new Error(
      `chartFolder "${chartFolder}" must be a path inside the project root "${project.root}".`,
    );
  }

  if (tree.exists(joinPathFragments(chartRoot, 'Chart.yaml'))) {
    throw new Error(`${chartRoot} already has a Chart.yaml.`);
  }

  // The plugin makes the chart a project of its own
  const pluginOptions = readHelmPluginOptions(tree);
  if (!pluginOptions) {
    throw new Error(
      'Charts are packaged as chart projects, which need the @nx-extensions/helm plugin. Run `nx add @nx-extensions/helm` first.',
    );
  }

  generateFiles(tree, path.join(__dirname, 'files', 'chart'), chartRoot, {
    ...options,
    name: chartName,
  });

  // Helm template syntax is not valid YAML, so formatters can't parse it
  const templates = joinPathFragments(chartRoot, 'templates');
  addToPrettierIgnore(tree, [`/${templates}`]);
  // Packaged dependencies that helm dependency build/update download
  addToGitIgnore(tree, [`/${joinPathFragments(chartRoot, 'charts')}/*.tgz`]);

  const projectName = chartProjectName(
    tree,
    pluginOptions,
    chartRoot,
    chartName,
  );
  logger.info(
    `The ${chartName} chart is the project ${projectName}; package it with \`nx run ${projectName}:${chartTargetNames(pluginOptions).package}\`.`,
  );

  if (!options.skipFormat) {
    await formatFilesExcept(tree, templates);
  }
}

/**
 * Formats the tree, keeping a folder out of it while it runs: older devkits'
 * formatFiles doesn't read the .prettierignore in the tree.
 */
export async function formatFilesExcept(tree: Tree, folder: string) {
  const held = holdBack(tree, folder);
  await formatFiles(tree);
  for (const [file, content] of held) {
    tree.write(file, content);
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
