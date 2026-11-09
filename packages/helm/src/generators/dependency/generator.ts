import path from 'node:path';

import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { isMap, isSeq, parseDocument } from 'yaml';

import { DependencyGeneratorSchema } from './schema.d';
import { checkRepositoryUrl } from '../../utils/repository';
import {
  chartTargetNames,
  findProjectRoot,
  readChartMetadata,
  readHelmPluginOptions,
  updateChartTargetOptions,
} from '../../utils/workspace';

interface Dependency {
  name: string;
  version: string;
  repository: string;
}

/** Adds a dependency to the Chart.yaml of a chart project. */
export async function dependencyGenerator(
  tree: Tree,
  options: DependencyGeneratorSchema,
) {
  const chartRoot = await findProjectRoot(tree, options.project);
  if (!tree.exists(joinPathFragments(chartRoot, 'Chart.yaml'))) {
    throw new Error(
      `Project ${options.project} is not a chart project: it has no Chart.yaml at its root.`,
    );
  }

  const dependency = options.chartProject
    ? await workspaceChart(tree, chartRoot, options.chartProject)
    : externalChart(options);
  // Rejects credentials in the URL and warns about plain HTTP
  const kind = checkRepositoryUrl(dependency.repository);

  // oci:// and file:// dependencies are used directly, without helm repo add
  if (kind === 'http' || kind === 'https') {
    if (!options.repositoryName) {
      throw new Error(
        `${dependency.repository} has to be added with helm repo add, so it needs a repositoryName.`,
      );
    }
    addRepository(tree, chartRoot, {
      name: options.repositoryName,
      url: dependency.repository,
    });
  }

  updateChartYaml(tree, chartRoot, dependency);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default dependencyGenerator;

function externalChart(options: DependencyGeneratorSchema): Dependency {
  const { chartName, chartVersion, repository } = options;
  if (!chartName || !chartVersion || !repository) {
    throw new Error(
      'Pass chartName, chartVersion and repository, or chartProject for a chart in this workspace.',
    );
  }
  return { name: chartName, version: chartVersion, repository };
}

/** A chart project in the workspace, as a file:// dependency. */
async function workspaceChart(
  tree: Tree,
  chartRoot: string,
  chartProject: string,
): Promise<Dependency> {
  const root = await findProjectRoot(tree, chartProject);
  if (root === chartRoot) {
    throw new Error(`A chart can't depend on itself.`);
  }
  const { name, version } = readChartMetadata(tree, root);
  return {
    name,
    version,
    repository: `file://${path.posix.relative(chartRoot, root)}`,
  };
}

/**
 * Chart projects get their repositories from a project.json at the chart root,
 * for every target that builds the chart's dependencies.
 */
function addRepository(
  tree: Tree,
  chartRoot: string,
  repository: { name: string; url: string },
) {
  const targets = chartTargetNames(readHelmPluginOptions(tree) ?? {});
  const file = joinPathFragments(chartRoot, 'project.json');
  const existing: Record<string, { options?: { repositories?: unknown } }> =
    tree.exists(file)
      ? (JSON.parse(tree.read(file, 'utf8') ?? '{}').targets ?? {})
      : {};
  updateChartTargetOptions(
    tree,
    chartRoot,
    Object.fromEntries(
      [targets.package, targets.push, targets.publish].map((target) => [
        target,
        {
          repositories: withRepository(
            existing[target]?.options?.repositories,
            repository,
          ),
        },
      ]),
    ),
  );
}

/**
 * Re-running the generator for the same repository updates its URL instead of
 * adding a duplicate.
 */
function withRepository(
  repositories: unknown,
  repository: { name: string; url: string },
) {
  return [
    ...(
      (Array.isArray(repositories) ? repositories : []) as {
        name: string;
      }[]
    ).filter((entry) => entry.name !== repository.name),
    repository,
  ];
}

function updateChartYaml(
  tree: Tree,
  chartRoot: string,
  dependency: Dependency,
) {
  const chartPath = joinPathFragments(chartRoot, 'Chart.yaml');
  if (!tree.exists(chartPath)) {
    throw new Error(`${chartPath} not found`);
  }

  // A YAML document instead of plain objects, so comments and formatting in
  // Chart.yaml survive the edit
  const chart = parseDocument(tree.read(chartPath, 'utf8') ?? '');
  if (chart.errors.length > 0) {
    throw new Error(
      `Failed to parse ${chartPath}: ${chart.errors.map((error) => error.message).join('; ')}`,
    );
  }

  let dependencies = chart.get('dependencies');
  if (!isSeq(dependencies)) {
    dependencies = chart.createNode([]);
    chart.set('dependencies', dependencies);
  }
  if (!isSeq(dependencies)) {
    throw new Error(`${chartPath} has an invalid dependencies block`);
  }

  const existing = dependencies.items.find(
    (item) => isMap(item) && item.get('name') === dependency.name,
  );
  if (isMap(existing)) {
    existing.set('version', dependency.version);
    existing.set('repository', dependency.repository);
  } else {
    dependencies.add(chart.createNode({ ...dependency }));
  }

  tree.write(chartPath, chart.toString());
}
