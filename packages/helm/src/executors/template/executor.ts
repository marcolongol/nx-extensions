import { logger, PromiseExecutor } from '@nx/devkit';

import { TemplateExecutorSchema } from './schema.d';
import { checkChart } from '../lint/check';

/** Checks that a chart renders with `helm template`. */
const runExecutor: PromiseExecutor<TemplateExecutorSchema> = (
  options,
  context,
) =>
  checkChart(options, context, async (helm, chartFolder, values) => {
    await helm.template(chartFolder, { values });
    logger.info(`${options.chartFolder} renders.`);
  });

export default runExecutor;
