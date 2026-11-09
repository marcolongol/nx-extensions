import { PromiseExecutor } from '@nx/devkit';

import { checkChart } from './check';
import { LintExecutorSchema } from './schema.d';

/** Lints a chart with `helm lint`. */
const runExecutor: PromiseExecutor<LintExecutorSchema> = (options, context) =>
  checkChart(options, context, (helm, chartFolder, values) =>
    helm.lint(chartFolder, { strict: options.strict, values }),
  );

export default runExecutor;
