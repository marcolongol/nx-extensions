import { existsSync } from 'node:fs';
import * as path from 'node:path';

import type { ProjectGraph, Tree } from '@nx/devkit';
import { runCommand } from '@nx-extensions/core';
import { AfterAllProjectsVersioned, VersionActions } from 'nx/release';
import { Document, isMap, isSeq, parseDocument, YAMLMap } from 'yaml';

const CHART_FILE = 'Chart.yaml';

/**
 * Folders of the charts whose dependency versions this release changed, for
 * afterAllProjectsVersioned. Nx loads the version actions and the hook from the
 * same module, so they share this.
 */
const chartsWithNewDependencies = new Set<string>();

function readDocument(tree: Tree, file: string): Document {
  const document = parseDocument(tree.read(file, 'utf8') ?? '');
  if (document.errors.length > 0) {
    throw new Error(
      `Failed to parse ${file}: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  }
  return document;
}

/** The chart name of a project, or null when the project isn't a chart. */
function chartNameOf(
  tree: Tree,
  projectGraph: ProjectGraph,
  project: string,
): string | null {
  const root = projectGraph.nodes[project]?.data.root;
  const chartFile = root === undefined ? '' : path.posix.join(root, CHART_FILE);
  if (!root || !tree.exists(chartFile)) {
    return null;
  }
  const name = readDocument(tree, chartFile).get('name');
  return typeof name === 'string' ? name : null;
}

function dependencyEntries(document: Document): YAMLMap[] {
  const dependencies = document.get('dependencies');
  return isSeq(dependencies) ? dependencies.items.filter(isMap) : [];
}

/**
 * A new version for a dependency entry: an exact version is replaced, a `^` or
 * `~` prefix is kept, and other ranges (e.g. `>=1.0.0`, `1.x`) are left as they
 * are, returning null.
 */
function nextDependencyVersion(
  current: string,
  version: string,
): string | null {
  if (/^\d+\.\d+\.\d+([-+].*)?$/.test(current)) {
    return version;
  }
  const prefixed = /^([~^])\d+\.\d+\.\d+([-+].*)?$/.exec(current);
  return prefixed ? `${prefixed[1]}${version}` : null;
}

/**
 * Nx Release version actions for Helm charts: the version lives in the chart's
 * Chart.yaml.
 *
 * - Dependencies on other charts in the workspace are updated to their new
 *   versions, e.g. the subcharts of an umbrella chart.
 * - A dependency on a project that isn't a chart (the app a chart deploys, see
 *   the plugin's `appVersion` option) sets the chart's `appVersion`.
 */
export default class HelmVersionActions extends VersionActions {
  validManifestFilenames = [CHART_FILE];
  // Prettier would reformat Chart.yaml; the yaml document API keeps its style
  override excludeManifestsFromFormatting = true;

  async readCurrentVersionFromSourceManifest(tree: Tree) {
    const manifestPath = path.posix.join(
      this.projectGraphNode.data.root,
      CHART_FILE,
    );
    const version = readDocument(tree, manifestPath).get('version');
    if (version === undefined || version === null) {
      throw new Error(`${manifestPath} has no version`);
    }
    return { currentVersion: String(version), manifestPath };
  }

  /** Not supported: chart versions are resolved from git tags or Chart.yaml. */
  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string,
  ) {
    const document = readDocument(
      tree,
      path.posix.join(this.projectGraphNode.data.root, CHART_FILE),
    );
    const chartName = chartNameOf(tree, projectGraph, dependencyProjectName);
    if (chartName === null) {
      const appVersion = document.get('appVersion');
      return {
        currentVersion: appVersion === undefined ? null : String(appVersion),
        dependencyCollection: 'appVersion',
      };
    }
    const entry = dependencyEntries(document).find(
      (dependency) => dependency.get('name') === chartName,
    );
    const version = entry?.get('version');
    return {
      currentVersion: version === undefined ? null : String(version),
      dependencyCollection: entry ? 'dependencies' : null,
    };
  }

  async updateProjectVersion(tree: Tree, newVersion: string) {
    const logs: string[] = [];
    for (const { manifestPath } of this.manifestsToUpdate) {
      const document = readDocument(tree, manifestPath);
      document.set('version', newVersion);
      tree.write(manifestPath, document.toString());
      logs.push(`✍️  New version ${newVersion} written to ${manifestPath}`);
    }
    return logs;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>,
  ) {
    const logs: string[] = [];
    for (const { manifestPath } of this.manifestsToUpdate) {
      const document = readDocument(tree, manifestPath);
      let changed = false;

      for (const [project, version] of Object.entries(dependenciesToUpdate)) {
        const chartName = chartNameOf(tree, projectGraph, project);
        if (chartName === null) {
          if (String(document.get('appVersion')) !== version) {
            document.set('appVersion', version);
            changed = true;
            logs.push(
              `✍️  Set appVersion to ${version} (from ${project}) in ${manifestPath}`,
            );
          }
          continue;
        }

        const entry = dependencyEntries(document).find(
          (dependency) => dependency.get('name') === chartName,
        );
        const current = entry?.get('version');
        if (!entry || current === undefined) {
          continue;
        }
        const next = nextDependencyVersion(String(current), version);
        if (next === null) {
          logs.push(
            `⏭️  Left the ${chartName} dependency at "${current}" in ${manifestPath}; only exact, ^ and ~ versions are updated`,
          );
        } else if (next !== String(current)) {
          entry.set('version', next);
          changed = true;
          chartsWithNewDependencies.add(path.posix.dirname(manifestPath));
          logs.push(
            `✍️  Updated the ${chartName} dependency to ${next} in ${manifestPath}`,
          );
        }
      }

      if (changed) {
        tree.write(manifestPath, document.toString());
      }
    }
    return logs;
  }
}

/**
 * Helm refuses to build a chart whose Chart.lock is out of sync with its
 * Chart.yaml, so refresh the locks of the charts whose dependency versions this
 * release changed. `rootVersionActionsOptions.plainHttp` passes --plain-http,
 * for OCI dependencies on registries without TLS.
 */
export const afterAllProjectsVersioned: AfterAllProjectsVersioned = async (
  cwd,
  { dryRun, rootVersionActionsOptions },
) => {
  const charts = [...chartsWithNewDependencies].filter((chart) =>
    existsSync(path.join(cwd, chart, 'Chart.lock')),
  );
  chartsWithNewDependencies.clear();

  if (!dryRun) {
    for (const chart of charts) {
      await runCommand(
        'helm',
        [
          'dependency',
          'update',
          '--skip-refresh',
          ...(rootVersionActionsOptions?.['plainHttp'] ? ['--plain-http'] : []),
          '--',
          chart,
        ],
        { cwd },
      );
    }
  }
  return {
    changedFiles: charts.map((chart) => path.posix.join(chart, 'Chart.lock')),
    deletedFiles: [],
  };
};
