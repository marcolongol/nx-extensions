/**
 * Options of the `@nx-extensions/helm:dependency` generator; keep in sync with
 * schema.json.
 */

export interface DependencyGeneratorSchema {
  /**
   * The chart project, or a project with a helm target, to add the dependency
   * to.
   */
  project: string;
  /** A chart project in this workspace to depend on, as a file:// dependency. */
  chartProject?: string;
  /** Chart Name of the Dependency */
  chartName?: string;
  /** Chart Version of the Dependency */
  chartVersion?: string;
  /** Repository of the Dependency */
  repository?: string;
  /** Name for `helm repo add`; needed for https:// and http:// repositories. */
  repositoryName?: string;
  /** @deprecated Files are now always formatted. Use `skipFormat` to opt out. */
  format?: boolean;
  /** Skip formatting the updated files. */
  skipFormat?: boolean;
  [k: string]: unknown;
}
