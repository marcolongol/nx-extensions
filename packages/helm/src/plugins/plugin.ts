import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  CreateNodesResult,
  DependencyType,
  logger,
  RawProjectGraphDependency,
} from '@nx/devkit';
import { parse } from 'yaml';

import { PackageExecutorSchema } from '../executors/package/schema.d';

export interface HelmPluginOptions {
  /** Name of the chart projects; `{chartName}` is the `name` in Chart.yaml. */
  projectName?: string;
  /** Name of the target that packages the chart. */
  packageTargetName?: string;
  /** Name of the target that packages and pushes the chart. */
  pushTargetName?: string;
  /** Where packaged charts go. */
  outputFolder?: string;
  /** OCI registry the push target pushes to, e.g. `oci://ghcr.io/my-org/charts`. */
  remote?: string;
  /** Use plain HTTP for OCI registries without TLS. */
  plainHttp?: boolean;
  /**
   * `project`: a chart inside another project's folder depends on that project,
   * so releasing the project bumps the chart and sets its `appVersion` to the
   * project's new version. `none` (default): no link.
   */
  appVersion?: 'none' | 'project';
}

interface Chart {
  name?: unknown;
  dependencies?: { name?: unknown; repository?: unknown }[];
}

const PACKAGE_EXECUTOR = '@nx-extensions/helm:package';
const RELEASE_PUBLISH_EXECUTOR = '@nx-extensions/helm:release-publish';
const CHART_FILE = 'Chart.yaml';

/** The options the plugin uses when nx.json doesn't set them. */
export const defaultPluginOptions = {
  projectName: '{chartName}-chart',
  packageTargetName: 'helm-package',
  pushTargetName: 'helm-push',
  outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
  appVersion: 'none',
} satisfies HelmPluginOptions;

function readChart(workspaceRoot: string, chartFile: string): Chart | null {
  try {
    return (parse(readFileSync(path.join(workspaceRoot, chartFile), 'utf8')) ??
      null) as Chart | null;
  } catch (error) {
    logger.warn(
      `@nx-extensions/helm: skipping ${chartFile}, which is not valid YAML: ${error instanceof Error ? error.message : error}`,
    );
    return null;
  }
}

/**
 * Whether a Chart.yaml should not become a project: vendored subcharts in
 * another chart's `charts/` folder, and files under `node_modules` or `dist`.
 */
function isIgnored(workspaceRoot: string, chartFile: string): boolean {
  const segments = chartFile.split('/');
  if (segments.includes('node_modules') || segments[0] === 'dist') {
    return true;
  }
  const chartsFolder = path.posix.dirname(path.posix.dirname(chartFile));
  return (
    path.posix.basename(chartsFolder) === 'charts' &&
    existsSync(
      path.join(workspaceRoot, path.posix.dirname(chartsFolder), CHART_FILE),
    )
  );
}

function chartProject(
  chartRoot: string,
  chartName: string,
  options: Required<
    Omit<HelmPluginOptions, 'remote' | 'plainHttp' | 'appVersion'>
  > &
    Pick<HelmPluginOptions, 'remote' | 'plainHttp'>,
): CreateNodesResult {
  const packageOptions: PackageExecutorSchema = {
    chartFolder: '{projectRoot}',
    outputFolder: options.outputFolder,
  };
  return {
    projects: {
      [chartRoot]: {
        name: options.projectName.replace('{chartName}', chartName),
        tags: ['helm-chart'],
        metadata: { technologies: ['helm'] },
        targets: {
          [options.packageTargetName]: {
            executor: PACKAGE_EXECUTOR,
            cache: true,
            // ^default: an umbrella chart packages its file:// subcharts too
            inputs: ['default', '^default'],
            outputs: ['{options.outputFolder}'],
            options: packageOptions,
            metadata: { description: `Package the ${chartName} Helm chart` },
          },
          [options.pushTargetName]: {
            executor: PACKAGE_EXECUTOR,
            options: {
              ...packageOptions,
              push: true,
              ...(options.remote ? { remote: options.remote } : {}),
              ...(options.plainHttp ? { plainHttp: true } : {}),
            },
            metadata: {
              description: `Package the ${chartName} Helm chart and push it to an OCI registry`,
            },
          },
          // Run by `nx release publish`; charts this one depends on go first
          'nx-release-publish': {
            executor: RELEASE_PUBLISH_EXECUTOR,
            dependsOn: ['^nx-release-publish'],
            options: {
              ...packageOptions,
              ...(options.remote ? { remote: options.remote } : {}),
              ...(options.plainHttp ? { plainHttp: true } : {}),
            },
            metadata: {
              description: `Publish the ${chartName} Helm chart as part of nx release publish`,
            },
          },
        },
      },
    },
  };
}

const createNodesFunction: CreateNodes<HelmPluginOptions>[1] = async (
  chartFiles,
  userOptions,
  context: CreateNodesContext,
) => {
  const options = { ...defaultPluginOptions, ...userOptions };
  const results: [string, CreateNodesResult][] = [];
  for (const chartFile of chartFiles) {
    if (isIgnored(context.workspaceRoot, chartFile)) continue;
    const chartRoot = path.posix.dirname(chartFile);

    const chart = readChart(context.workspaceRoot, chartFile);
    if (typeof chart?.name !== 'string' || !chart.name) {
      if (chart) {
        logger.warn(
          `@nx-extensions/helm: skipping ${chartFile}, which has no name`,
        );
      }
      continue;
    }
    results.push([chartFile, chartProject(chartRoot, chart.name, options)]);
  }
  return results;
};

const pattern = `**/${CHART_FILE}`;

/** Inferred chart projects, one per Chart.yaml. */
export const createNodes: CreateNodes<HelmPluginOptions> = [
  pattern,
  createNodesFunction,
];

/** The same as `createNodes`, under the name Nx 22 looks for. */
export const createNodesV2: CreateNodes<HelmPluginOptions> = createNodes;

/**
 * Graph edges from a chart to the workspace charts in its Chart.yaml
 * dependencies: `file://` paths that point at one, or `oci://` dependencies
 * with the name of one.
 */
export const createDependencies: CreateDependencies<HelmPluginOptions> = (
  options,
  context,
) => {
  const charts = Object.entries(context.projects).flatMap(
    ([project, config]) => {
      const chartFile = path.posix.join(config.root, CHART_FILE);
      if (!existsSync(path.join(context.workspaceRoot, chartFile))) return [];
      const chart = readChart(context.workspaceRoot, chartFile);
      return chart ? [{ project, root: config.root, chartFile, chart }] : [];
    },
  );
  const byRoot = new Map(charts.map((c) => [c.root, c.project]));
  const byName = new Map(charts.map((c) => [c.chart.name, c.project]));

  const dependencies: RawProjectGraphDependency[] = [];
  for (const { project, root, chartFile, chart } of charts) {
    for (const dependency of chart.dependencies ?? []) {
      const repository =
        typeof dependency.repository === 'string' ? dependency.repository : '';
      let target: string | undefined;
      if (repository.startsWith('file://')) {
        target = byRoot.get(
          path.posix.normalize(
            path.posix.join(root, repository.slice('file://'.length)),
          ),
        );
      } else if (repository.startsWith('oci://')) {
        target = byName.get(dependency.name);
      }
      if (target && target !== project) {
        dependencies.push({
          source: project,
          target,
          type: DependencyType.static,
          sourceFile: chartFile,
        });
      }
    }

    if (options?.appVersion === 'project') {
      const app = enclosingProject(context.projects, root);
      if (app) {
        dependencies.push({
          source: project,
          target: app,
          type: DependencyType.implicit,
        });
      }
    }
  }
  return dependencies;
};

/** The project whose folder most closely contains a chart's folder. */
function enclosingProject(
  projects: Record<string, { root: string }>,
  chartRoot: string,
): string | undefined {
  let best: { project: string; depth: number } | undefined;
  for (const [project, { root }] of Object.entries(projects)) {
    const contains =
      root !== chartRoot &&
      (root === '.' || root === '' || chartRoot.startsWith(`${root}/`));
    const depth = root === '.' || root === '' ? 0 : root.split('/').length;
    if (contains && (!best || depth > best.depth)) {
      best = { project, depth };
    }
  }
  return best?.project;
}
