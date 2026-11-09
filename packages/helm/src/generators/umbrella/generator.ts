import path from 'node:path';

import {
  createProjectGraphAsync,
  formatFiles,
  generateFiles,
  joinPathFragments,
  logger,
  normalizePath,
  Tree,
} from '@nx/devkit';
import { isPathInside } from '@nx-extensions/core';
import { prompt } from 'enquirer';
import { stringify } from 'yaml';

import { UmbrellaGeneratorSchema } from './schema.d';
import {
  addToGitIgnore,
  chartProjectName,
  chartTargetNames,
  findProjectRoot,
  readChartMetadata,
  readHelmPluginOptions,
  updateChartTargetOptions,
} from '../../utils/workspace';
import { toChartName } from '../chart/generator';

/**
 * Adds an umbrella chart: a chart without templates of its own whose
 * dependencies are chart projects of this workspace, as file:// subcharts.
 * Packaging it bundles the subcharts, and nx release bumps it when they
 * change.
 */
export async function umbrellaGenerator(
  tree: Tree,
  options: UmbrellaGeneratorSchema,
) {
  const pluginOptions = readHelmPluginOptions(tree);
  if (!pluginOptions) {
    throw new Error(
      'Umbrella charts bundle chart projects, which need the @nx-extensions/helm plugin. Run `nx g @nx-extensions/helm:init` first.',
    );
  }

  const charts = options.charts
    ? parseCharts(options.charts)
    : await pickCharts();
  if (charts.length === 0) {
    throw new Error('Pass at least one chart project in charts.');
  }

  const name = toChartName(options.name);
  const root = normalizePath(
    path.posix.normalize(options.directory ?? `charts/${name}`),
  );
  if (path.posix.isAbsolute(root) || !isPathInside('.', root) || root === '.') {
    throw new Error(
      `directory "${options.directory}" must be a folder inside the workspace.`,
    );
  }
  if (tree.exists(joinPathFragments(root, 'Chart.yaml'))) {
    throw new Error(`${root} already has a Chart.yaml.`);
  }

  const subcharts = [];
  for (const project of charts) {
    const chartRoot = await findProjectRoot(tree, project);
    const { name: chartName, version } = readChartMetadata(tree, chartRoot);
    subcharts.push({
      project,
      root: chartRoot,
      name: chartName,
      version,
      repository: `file://${path.posix.relative(root, chartRoot)}`,
    });
  }

  generateFiles(tree, path.join(__dirname, 'files'), root, {});
  tree.write(
    joinPathFragments(root, 'Chart.yaml'),
    stringify({
      apiVersion: 'v2',
      name,
      description: `Deploys ${subcharts.map((chart) => chart.name).join(', ')} together`,
      type: 'application',
      version: '0.1.0',
      dependencies: subcharts.map(({ name, version, repository }) => ({
        name,
        version,
        repository,
      })),
    }),
  );
  tree.write(joinPathFragments(root, 'values.yaml'), valuesYaml(subcharts));
  // Packaged subcharts that helm dependency build copies in
  addToGitIgnore(tree, [`/${joinPathFragments(root, 'charts')}/*.tgz`]);

  if (options.publishSubcharts === false) {
    const { publish } = chartTargetNames(pluginOptions);
    for (const chart of subcharts) {
      updateChartTargetOptions(tree, chart.root, {
        [publish]: { publish: false },
      });
    }
  }

  const projectName = chartProjectName(pluginOptions, name);
  logger.info(
    `The umbrella chart is the project ${projectName}; package it with \`nx run ${projectName}:${chartTargetNames(pluginOptions).package}\`.`,
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

/** A list, or a comma-separated string when called programmatically. */
function parseCharts(charts: string[] | string): string[] {
  const list = typeof charts === 'string' ? charts.split(',') : charts;
  return [...new Set(list.map((chart) => chart.trim()))].filter(Boolean);
}

/** Lets the user pick the charts from the workspace's chart projects. */
async function pickCharts(): Promise<string[]> {
  // nx generate sets NX_INTERACTIVE; --no-interactive and CI set it to false
  if (process.env.NX_INTERACTIVE !== 'true') {
    throw new Error(
      'Pass the chart projects to bundle, e.g. --charts=frontend-chart,backend-chart.',
    );
  }
  const graph = await createProjectGraphAsync();
  const choices = Object.values(graph.nodes)
    .filter((node) => node.data.tags?.includes('helm-chart'))
    .map((node) => node.name)
    .sort();
  if (choices.length === 0) {
    throw new Error(
      'There are no chart projects to bundle yet. Add charts with `nx g @nx-extensions/helm:chart` first.',
    );
  }
  const { charts } = await prompt<{ charts: string[] }>({
    type: 'multiselect',
    name: 'charts',
    message: 'Which chart projects should the umbrella chart bundle?',
    choices,
    // A multiselect passes the picked choices, not the string its types say
    validate: (picked: string) =>
      (picked as unknown as string[]).length > 0 ||
      'Pick at least one chart (space to select).',
  });
  return charts;
}

function valuesYaml(subcharts: { name: string }[]): string {
  return [
    '# Values for a subchart go under its name; values under global are passed',
    '# to every subchart.',
    'global: {}',
    ...subcharts.flatMap(({ name }) => ['', `${name}: {}`]),
    '',
  ].join('\n');
}

export default umbrellaGenerator;
