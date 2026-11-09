import * as path from 'node:path';

import { PromiseExecutor, ExecutorContext, logger } from '@nx/devkit';
import { resolvePathInside } from '@nx-extensions/core';

import { PackageExecutorSchema } from './schema.d';
import { createHelmClient, HelmClient } from '../../utils/helm';
import { checkRepositoryUrl } from '../../utils/repository';

const runExecutor: PromiseExecutor<PackageExecutorSchema> = async (
  options: PackageExecutorSchema,
  context: ExecutorContext,
) => {
  try {
    await packageChart(options, context);
    return { success: true };
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return { success: false };
  }
};

/**
 * Packages a chart, handling repositories and dependencies first, and pushes it
 * when `push` is set. Throws on invalid options or when helm fails.
 */
export async function packageChart(
  options: PackageExecutorSchema,
  context: ExecutorContext,
) {
  // Nx runs executors from the directory `nx` was started in, so resolve the
  // options against the workspace root instead of the current directory
  const chartFolder = resolvePathInside(
    context.root,
    options.chartFolder,
    'chartFolder',
  );
  // An absolute output folder (e.g. $RUNNER_TEMP) is fine, but a relative
  // one must not climb out of the workspace
  const outputFolder = path.isAbsolute(options.outputFolder)
    ? options.outputFolder
    : resolvePathInside(context.root, options.outputFolder, 'outputFolder');

  const remote = options.remote ?? '';
  if (options.push && !remote.startsWith('oci://')) {
    throw new Error(
      `remote must be an oci:// registry URL when push is set, got "${remote}".`,
    );
  }

  const helm = createHelmClient({ env: helmEnv(context.root) });
  await prepareDependencies(helm, chartFolder, options);

  const chartPath = await helm.package({
    chartFolder,
    outputFolder,
    version: options.chartVersion,
    appVersion: options.appVersion,
  });

  if (options.push) {
    await helm.push({
      chartPath,
      remote,
      plainHttp: options.plainHttp,
    });
  }
}

/**
 * Adds the chart's repositories and updates or builds its dependencies, as the
 * options say. Shared by the executors that need a chart's dependencies.
 */
export async function prepareDependencies(
  helm: HelmClient,
  chartFolder: string,
  options: Pick<
    PackageExecutorSchema,
    'repositories' | 'plainHttp' | 'updateDependencies' | 'buildDependencies'
  >,
) {
  const repositories = (options.repositories ?? []).map((repository) => {
    if (!repository.name || !repository.url) {
      throw new Error(
        `Each repositories entry needs a name and a url, got ${JSON.stringify(repository)}.`,
      );
    }
    return {
      name: repository.name,
      url: repository.url,
      kind: checkRepositoryUrl(repository.url),
      username: repository.username,
      password: readPassword(repository.name, repository.passwordEnv),
    };
  });

  for (const repository of repositories) {
    // OCI and local file dependencies are resolved without a repository entry
    if (repository.kind === 'oci' || repository.kind === 'file') {
      continue;
    }
    await helm.addRepository(repository.name, repository.url, {
      username: repository.username,
      password: repository.password,
    });
  }

  const dependencyOptions = { plainHttp: options.plainHttp };
  if (options.updateDependencies ?? false) {
    await helm.dependencyUpdate(chartFolder, dependencyOptions);
  }
  if (options.buildDependencies ?? true) {
    await helm.dependencyBuild(chartFolder, dependencyOptions);
  }
}

function readPassword(
  repository: string,
  passwordEnv: string | undefined,
): string | undefined {
  if (!passwordEnv) {
    return undefined;
  }
  const password = process.env[passwordEnv];
  if (!password) {
    throw new Error(
      `Environment variable ${passwordEnv} for the password of repository "${repository}" is not set.`,
    );
  }
  return password;
}

/**
 * Keeps the repositories the executor adds out of the user's global Helm
 * config, in a cache folder that is never committed. A HELM_REPOSITORY_CONFIG
 * or HELM_REPOSITORY_CACHE the user set wins.
 */
export function helmEnv(workspaceRoot: string): NodeJS.ProcessEnv {
  const cache = path.join(
    workspaceRoot,
    'node_modules',
    '.cache',
    '@nx-extensions',
    'helm',
  );
  return {
    ...process.env,
    HELM_REPOSITORY_CONFIG:
      process.env['HELM_REPOSITORY_CONFIG'] ??
      path.join(cache, 'repositories.yaml'),
    HELM_REPOSITORY_CACHE:
      process.env['HELM_REPOSITORY_CACHE'] ??
      path.join(cache, 'repository-cache'),
  };
}

export default runExecutor;
