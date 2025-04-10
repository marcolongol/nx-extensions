import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { createHelmClient } from '@nx-extensions/core';

import { PackageExecutorSchema } from './schema.d';

const runExecutor: PromiseExecutor<PackageExecutorSchema> = async (
  options: PackageExecutorSchema,
  context: ExecutorContext,
) => {
  const helm = createHelmClient();

  if (options.dependencies.repositories) {
    for (const repository of options.dependencies.repositories) {
      await helm.addRepository(repository.name, repository.url);
    }
  }

  if (options.dependencies.update) {
    await helm.dependencyUpdate(options.chartFolder);
  }

  if (options.dependencies.build) {
    await helm.dependencyBuild(options.chartFolder);
  }

  const chartPath = await helm.package({
    chartFolder: options.chartFolder,
    outputFolder: options.outputFolder,
    version: options.version,
    appVersion: options.appVersion,
  });

  if (options.push) {
    await helm.push({
      chartPath: chartPath,
      remote: options.remote,
    });
  }

  return {
    success: true,
  };
};

export default runExecutor;
