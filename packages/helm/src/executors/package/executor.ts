import { PromiseExecutor } from '@nx/devkit';
import { ExecutorContext } from '@nx/devkit';
import { PackageExecutorSchema } from './schema';
import { createHelmClient } from '../../helm/helm';

const runExecutor: PromiseExecutor<PackageExecutorSchema> = async (
  options: PackageExecutorSchema,
  context: ExecutorContext
) => {
  const helm = createHelmClient();

  await helm.package({
    chartFolder: options.chartFolder,
    outputFolder: options.outputFolder,
  });

  return {
    success: true,
  };
};

export default runExecutor;
