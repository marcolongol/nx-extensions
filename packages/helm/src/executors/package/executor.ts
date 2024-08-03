import { PromiseExecutor, ExecutorContext } from '@nx/devkit';

import { PackageExecutorSchema } from './schema.d';
import { createHelmClient } from '../../helm/helm';

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
