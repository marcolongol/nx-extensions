/**
 * Options of the `@nx-extensions/helm:lint` executor; keep in sync with
 * schema.json.
 */
import { HelmRepository } from '../package/schema.d';

export interface ChartCheckOptions {
  /** Folder of the chart, relative to the workspace root. */
  chartFolder: string;
  /** Values files, relative to the chart folder. */
  values?: string[];
  /** Run `helm dependency build` first. Defaults to true. */
  buildDependencies?: boolean;
  /** Chart repositories to add before building dependencies. */
  repositories?: HelmRepository[];
  /** Use plain HTTP for OCI dependencies from registries without TLS. */
  plainHttp?: boolean;
}

export interface LintExecutorSchema extends ChartCheckOptions {
  /** Fail on lint warnings too (`helm lint --strict`). */
  strict?: boolean;
}
