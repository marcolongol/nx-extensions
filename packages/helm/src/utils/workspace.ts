import {
  createProjectGraphAsync,
  joinPathFragments,
  PluginConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { parse } from 'yaml';

import { HelmPluginOptions } from '../plugins/plugin';

export const PLUGIN_NAME = '@nx-extensions/helm';

const pluginName = (plugin: PluginConfiguration) =>
  typeof plugin === 'string' ? plugin : plugin.plugin;

/** The plugin's options in nx.json, or null when the plugin isn't registered. */
export function readHelmPluginOptions(tree: Tree): HelmPluginOptions | null {
  const plugin = readNxJson(tree)?.plugins?.find(
    (entry) => pluginName(entry) === PLUGIN_NAME,
  );
  if (!plugin) {
    return null;
  }
  return typeof plugin === 'string'
    ? {}
    : ((plugin.options ?? {}) as HelmPluginOptions);
}

/**
 * Registers the plugin in nx.json, with the given options. Returns false when
 * it was already registered, in which case nx.json is left alone.
 */
export function registerHelmPlugin(
  tree: Tree,
  options: HelmPluginOptions = {},
): boolean {
  const nxJson = readNxJson(tree) ?? {};
  if (
    (nxJson.plugins ?? []).some((entry) => pluginName(entry) === PLUGIN_NAME)
  ) {
    return false;
  }
  nxJson.plugins = [
    ...(nxJson.plugins ?? []),
    Object.keys(options).length > 0
      ? { plugin: PLUGIN_NAME, options }
      : PLUGIN_NAME,
  ];
  updateNxJson(tree, nxJson);
  return true;
}

/**
 * The root of a project. Projects with a project.json or package.json are found
 * in the tree; inferred projects, such as chart projects, only exist in the
 * project graph.
 */
export async function findProjectRoot(
  tree: Tree,
  project: string,
): Promise<string> {
  try {
    return readProjectConfiguration(tree, project).root;
  } catch {
    const graph = await createProjectGraphAsync();
    const root = graph.nodes[project]?.data.root;
    if (root === undefined) {
      throw new Error(`Cannot find a project named "${project}".`);
    }
    return root;
  }
}

/** Appends entries to the workspace .gitignore that aren't in it yet. */
export function addToGitIgnore(tree: Tree, entries: string[]) {
  const content = tree.exists('.gitignore')
    ? (tree.read('.gitignore', 'utf8') ?? '')
    : '';
  const existing = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = entries.filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    return;
  }
  const prefix = content.length === 0 || content.endsWith('\n') ? '' : '\n';
  tree.write('.gitignore', `${content}${prefix}${missing.join('\n')}\n`);
}

/** The name the plugin gives the project of a chart. */
export function chartProjectName(
  options: HelmPluginOptions,
  chartName: string,
) {
  return (options.projectName ?? '{chartName}-chart').replace(
    '{chartName}',
    chartName,
  );
}

/** The names the plugin gives a chart project's targets. */
export function chartTargetNames(options: HelmPluginOptions) {
  return {
    package: options.packageTargetName ?? 'helm-package',
    push: options.pushTargetName ?? 'helm-push',
    publish: 'nx-release-publish',
  };
}

/**
 * Sets target options of a chart project in a project.json at the chart root.
 * Nx merges it into the inferred project, so only the options that differ from
 * what the plugin infers are written. The file names the project too: without a
 * name, Nx names it after its folder, and every `chart` folder would clash.
 */
export function updateChartTargetOptions(
  tree: Tree,
  chartRoot: string,
  targets: Record<string, Record<string, unknown>>,
) {
  const file = joinPathFragments(chartRoot, 'project.json');
  const existing: {
    name?: string;
    targets?: Record<string, { options?: Record<string, unknown> }>;
  } = tree.exists(file) ? readJson(tree, file) : {};
  const config = {
    name: chartProjectName(
      readHelmPluginOptions(tree) ?? {},
      readChartMetadata(tree, chartRoot).name,
    ),
    ...existing,
    targets: { ...existing.targets },
  };
  for (const [target, options] of Object.entries(targets)) {
    const current = config.targets[target] ?? {};
    config.targets[target] = {
      ...current,
      options: { ...current.options, ...options },
    };
  }
  writeJson(tree, file, config);
}

/** Reads the name and version of the chart in a folder. */
export function readChartMetadata(
  tree: Tree,
  chartRoot: string,
): { name: string; version: string } {
  const file = joinPathFragments(chartRoot, 'Chart.yaml');
  if (!tree.exists(file)) {
    throw new Error(`${file} not found.`);
  }
  const chart = parse(tree.read(file, 'utf8') ?? '') as {
    name?: unknown;
    version?: unknown;
  } | null;
  if (typeof chart?.name !== 'string' || typeof chart.version !== 'string') {
    throw new Error(`${file} needs a name and a version.`);
  }
  return { name: chart.name, version: chart.version };
}
