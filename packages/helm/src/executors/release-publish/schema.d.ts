/**
 * Options of the `@nx-extensions/helm:release-publish` executor; keep in sync
 * with schema.json.
 */

import { HelmRepository } from '../package/schema.d';

export interface ReleasePublishExecutorSchema {
  /** Folder of the chart, relative to the workspace root. */
  chartFolder: string;
  /** Folder for the packaged chart, relative to the workspace root or absolute. */
  outputFolder: string;
  /** OCI registry to push the chart to. */
  remote?: string;
  /** Use plain HTTP instead of TLS for OCI registries. */
  plainHttp?: boolean;
  /**
   * Set to false for a chart that should not be pushed on its own. Defaults to
   * true.
   */
  publish?: boolean;
  /** Chart repositories to add before building dependencies. */
  repositories?: HelmRepository[];
  /** Package the chart without pushing it. */
  dryRun?: boolean;
}
