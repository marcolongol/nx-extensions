import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { ExecutorContext, logger, PromiseExecutor } from '@nx/devkit';
import { resolvePathInside } from '@nx-extensions/core';
import { parse } from 'yaml';

import { ReleasePublishExecutorSchema } from './schema.d';
import { createHelmClient } from '../../utils/helm';
import { helmEnv, packageChart } from '../package/executor';

/**
 * The `nx-release-publish` target of chart projects: pushes the chart at the
 * version `nx release` wrote to its Chart.yaml, unless that version is already
 * in the registry.
 */
const runExecutor: PromiseExecutor<ReleasePublishExecutorSchema> = async (
  options,
  context,
) => {
  try {
    await publishChart(options, context);
    return { success: true };
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return { success: false };
  }
};

async function publishChart(
  options: ReleasePublishExecutorSchema,
  context: ExecutorContext,
) {
  const chartFolder = resolvePathInside(
    context.root,
    options.chartFolder,
    'chartFolder',
  );
  const chart =
    parse(readFileSync(path.join(chartFolder, 'Chart.yaml'), 'utf8')) ?? {};
  const label = `${chart.name}@${chart.version}`;

  if (options.publish === false) {
    logger.info(`Skipped publishing ${label}: publish is set to false`);
    return;
  }

  const remote = (options.remote ?? '').replace(/\/+$/, '');
  if (!remote.startsWith('oci://')) {
    throw new Error(
      `Can't publish ${label}: set the remote option (e.g. in the @nx-extensions/helm plugin options) to an oci:// registry, got "${options.remote ?? ''}".`,
    );
  }

  const helm = createHelmClient({ env: helmEnv(context.root) });
  const exists = await helm.chartExists(
    `${remote}/${chart.name}`,
    String(chart.version),
    { plainHttp: options.plainHttp },
  );
  if (exists) {
    logger.info(`Skipped publishing ${label}: it is already in ${remote}`);
    return;
  }

  await packageChart(
    {
      chartFolder: options.chartFolder,
      outputFolder: options.outputFolder,
      remote,
      plainHttp: options.plainHttp,
      push: !options.dryRun,
      buildDependencies: true,
      updateDependencies: false,
      repositories: options.repositories,
    },
    context,
  );
  logger.info(
    options.dryRun
      ? `Would publish ${label} to ${remote}, but --dry-run was set`
      : `Published ${label} to ${remote}`,
  );
}

export default runExecutor;
