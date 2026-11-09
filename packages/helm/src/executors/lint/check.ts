import * as path from 'node:path';

import { ExecutorContext, logger } from '@nx/devkit';
import { resolvePathInside } from '@nx-extensions/core';

import { ChartCheckOptions } from './schema.d';
import { createHelmClient, HelmClient } from '../../utils/helm';
import { helmEnv, prepareDependencies } from '../package/executor';

/**
 * Runs a check on a chart, after building its dependencies: a chart that
 * depends on other charts can't be linted or rendered without them.
 */
export async function checkChart(
  options: ChartCheckOptions,
  context: ExecutorContext,
  check: (
    helm: HelmClient,
    chartFolder: string,
    values: string[],
  ) => Promise<void>,
): Promise<{ success: boolean }> {
  try {
    const chartFolder = resolvePathInside(
      context.root,
      options.chartFolder,
      'chartFolder',
    );
    // Values files are relative to the chart, and must stay in the workspace
    const values = (options.values ?? []).map((file) =>
      resolvePathInside(
        context.root,
        path.resolve(chartFolder, file),
        'values',
      ),
    );
    const helm = createHelmClient({ env: helmEnv(context.root) });
    await prepareDependencies(helm, chartFolder, {
      ...options,
      updateDependencies: false,
    });
    await check(helm, chartFolder, values);
    return { success: true };
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return { success: false };
  }
}
