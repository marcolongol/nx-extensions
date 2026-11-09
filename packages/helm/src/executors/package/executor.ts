import path from 'node:path';

import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { createHelmClient, resolvePathInside } from '@nx-extensions/core';

import { PackageExecutorSchema } from './schema.d';

const runExecutor: PromiseExecutor<PackageExecutorSchema> = async (
  options: PackageExecutorSchema,
  context: ExecutorContext,
) => {
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

  // Nx 24 doesn't fill in nested defaults when the object itself is missing,
  // so apply the schema defaults here
  const dependencies = options.dependencies ?? {};
  const repositories = (dependencies.repositories ?? []).map((repository) => {
    if (!repository.name || !repository.url) {
      throw new Error(
        `Each dependencies.repositories entry needs a name and a url, got ${JSON.stringify(repository)}.`,
      );
    }
    return { name: repository.name, url: repository.url };
  });

  const helm = createHelmClient();

  for (const repository of repositories) {
    await helm.addRepository(repository.name, repository.url);
  }

  if (dependencies.update ?? true) {
    await helm.dependencyUpdate(chartFolder);
  }

  if (dependencies.build ?? false) {
    await helm.dependencyBuild(chartFolder);
  }

  const chartPath = await helm.package({
    chartFolder,
    outputFolder,
    version: options.version,
    appVersion: options.appVersion,
  });

  if (options.push) {
    if (!chartPath) {
      throw new Error('Could not determine the packaged chart path.');
    }
    await helm.push({
      chartPath,
      remote,
      plainHttp: options.plainHttp,
    });
  }

  return {
    success: true,
  };
};

export default runExecutor;
