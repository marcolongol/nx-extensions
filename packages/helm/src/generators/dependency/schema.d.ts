/**
 * Options of the `@nx-extensions/helm:dependency` generator; keep in sync with
 * schema.json.
 */

export interface DependencyGeneratorSchema {
  /** Project name */
  project: string;
  /** Chart Name of the Dependency */
  chartName: string;
  /** Chart Version of the Dependency */
  chartVersion: string;
  /** Repository of the Dependency */
  repository: string;
  /** Repository Name of the Dependency */
  repositoryName: string;
  /** @deprecated Files are now always formatted. Use `skipFormat` to opt out. */
  format?: boolean;
  /** Skip formatting the updated files. */
  skipFormat?: boolean;
  [k: string]: unknown;
}
