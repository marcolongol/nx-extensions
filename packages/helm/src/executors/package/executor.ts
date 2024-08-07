import { PromiseExecutor, ExecutorContext } from '@nx/devkit';
import { createHelmClient } from '@nx-extensions/core';

import { PackageExecutorSchema } from './schema.d';

const runExecutor: PromiseExecutor<PackageExecutorSchema> = async (
  options: PackageExecutorSchema,
  context: ExecutorContext,
) => {
  const helm = createHelmClient();

  const chartPath = await helm.package({
    chartFolder: options.chartFolder,
    outputFolder: options.outputFolder,
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
