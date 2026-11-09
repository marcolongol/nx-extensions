import path from 'node:path';

import {
  formatFiles,
  getProjects,
  joinPathFragments,
  logger,
  normalizePath,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { isPathInside } from '@nx-extensions/core';

import { PackageExecutorSchema } from '../../executors/package/schema.d';
import { HelmPluginOptions } from '../../plugins/plugin';
import {
  chartProjectName,
  chartTargetNames,
  readChartMetadata,
  readHelmPluginOptions,
  registerHelmPlugin,
  updateChartTargetOptions,
} from '../../utils/workspace';

const PACKAGE_EXECUTOR = '@nx-extensions/helm:package';
/** The outputFolder the chart generator used to write. */
const GENERATED_OUTPUT_FOLDER = '{workspaceRoot}/dist/charts/{projectRoot}';

interface Conversion {
  project: ProjectConfiguration & { name: string };
  targetName: string;
  options: Partial<PackageExecutorSchema>;
  chartRoot: string;
  chartName: string;
}

/**
 * 2.0.0 packages charts as chart projects that the plugin infers. Registers the
 * plugin, removes the package executor targets, and writes the options that
 * differ from what the plugin infers to a project.json at the chart root. Runs
 * after update-package-executor-options, so the options are already renamed.
 */
export default async function update(tree: Tree) {
  const conversions = findConversions(tree);

  let pluginOptions = readHelmPluginOptions(tree);
  if (!pluginOptions) {
    pluginOptions = sharedPushOptions(conversions);
    registerHelmPlugin(tree, pluginOptions);
  }
  const targets = chartTargetNames(pluginOptions);

  for (const conversion of conversions) {
    const { project, targetName, chartRoot, chartName } = conversion;
    const overrides = chartOverrides(conversion, pluginOptions);
    const targetOverrides = Object.fromEntries(
      Object.entries({
        [targets.package]: overrides.build,
        [targets.push]: { ...overrides.build, ...overrides.push },
        [targets.publish]: { ...overrides.publish, ...overrides.push },
      }).filter(([, values]) => Object.keys(values).length > 0),
    );
    if (Object.keys(targetOverrides).length > 0) {
      updateChartTargetOptions(tree, chartRoot, targetOverrides);
    }

    const { [targetName]: _removed, ...rest } = project.targets ?? {};
    updateProjectConfiguration(tree, project.name, {
      ...project,
      targets: rest,
    });

    const chartProject = chartProjectName(pluginOptions, chartName);
    logger.info(
      `${project.name}:${targetName} is now the chart project ${chartProject}: run ${chartProject}:${conversion.options.push ? targets.push : targets.package}.`,
    );
    const dependents = Object.entries(rest)
      .filter(([, target]) => dependsOnTarget(target, targetName))
      .map(([name]) => `${project.name}:${name}`);
    if (dependents.length > 0) {
      logger.warn(
        `${dependents.join(', ')} depend on ${project.name}:${targetName}, which is gone; point them at ${chartProject}:${targets.package}.`,
      );
    }
  }

  await formatFiles(tree);
}

function findConversions(tree: Tree): Conversion[] {
  const conversions: Conversion[] = [];
  for (const [name, project] of getProjects(tree)) {
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (target.executor !== PACKAGE_EXECUTOR) continue;
      const label = `${name}:${targetName}`;
      if (Object.keys(target.configurations ?? {}).length > 0) {
        logger.warn(
          `Skipped ${label}: it has configurations, which chart projects can't take over. Move it to a chart project by hand.`,
        );
        continue;
      }
      const options = (target.options ?? {}) as Partial<PackageExecutorSchema>;
      const chartRoot = normalizePath(
        path.posix.normalize(
          (options.chartFolder ?? '').replace('{projectRoot}', project.root),
        ),
      );
      if (
        !options.chartFolder ||
        !isPathInside(project.root, chartRoot) ||
        !tree.exists(joinPathFragments(chartRoot, 'Chart.yaml'))
      ) {
        logger.warn(
          `Skipped ${label}: no Chart.yaml in its chartFolder "${options.chartFolder}".`,
        );
        continue;
      }
      conversions.push({
        project: { ...project, name },
        targetName,
        options,
        chartRoot,
        chartName: readChartMetadata(tree, chartRoot).name,
      });
    }
  }
  return conversions;
}

/** The remote and plainHttp every converted target agrees on, for nx.json. */
function sharedPushOptions(conversions: Conversion[]): HelmPluginOptions {
  const withRemote = conversions.filter(({ options }) => options.remote);
  const remotes = new Set(withRemote.map(({ options }) => options.remote));
  if (remotes.size !== 1 || withRemote.length !== conversions.length) {
    return {};
  }
  return {
    remote: [...remotes][0],
    ...(withRemote.every(({ options }) => options.plainHttp)
      ? { plainHttp: true }
      : {}),
  };
}

/**
 * The options of a converted target that differ from what the plugin infers:
 * `build` ones for the targets that package the chart, `push` ones for the
 * targets that push it, and `publish` the ones nx-release-publish takes.
 */
function chartOverrides(
  { project, options }: Conversion,
  plugin: HelmPluginOptions,
) {
  const build: Record<string, unknown> = {};
  if (options.repositories?.length) build.repositories = options.repositories;
  if (
    options.outputFolder &&
    options.outputFolder !== GENERATED_OUTPUT_FOLDER
  ) {
    // {projectRoot} is the chart root in a chart project
    build.outputFolder = options.outputFolder.replace(
      '{projectRoot}',
      project.root,
    );
  }
  // nx-release-publish takes the options above, but not these: it always
  // builds dependencies and versions the chart from Chart.yaml
  const publish = { ...build };
  if (options.updateDependencies) build.updateDependencies = true;
  if (options.buildDependencies === false) build.buildDependencies = false;
  if (options.chartVersion) build.chartVersion = options.chartVersion;
  if (options.appVersion) build.appVersion = options.appVersion;

  const push: Record<string, unknown> = {};
  if (options.remote && options.remote !== plugin.remote) {
    push.remote = options.remote;
  }
  if (Boolean(options.plainHttp) !== Boolean(plugin.plainHttp)) {
    push.plainHttp = Boolean(options.plainHttp);
  }
  return { build, push, publish };
}

function dependsOnTarget(target: TargetConfiguration, name: string): boolean {
  return (target.dependsOn ?? []).some((dependency) =>
    typeof dependency === 'string'
      ? dependency.replace(/^\^/, '') === name
      : dependency.target === name,
  );
}
