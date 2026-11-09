/**
 * Options of the `@nx-extensions/helm:chart` generator; keep in sync with
 * schema.json.
 */

export interface ChartGeneratorSchema {
  /**
   * Name of the chart. Converted to a valid Kubernetes name (lowercase letters,
   * digits and `-`), so `my.app` becomes `my-app`.
   */
  name: string;
  /** Name of the project to add the chart to */
  project: string;
  /**
   * Folder for the chart, relative to the project root. The default `chart`
   * creates `{projectRoot}/chart`.
   */
  chartFolder?: string;
  /**
   * @deprecated Files are now always formatted and the chart templates are
   *   added to .prettierignore. Use `skipFormat` to opt out.
   */
  format?: boolean;
  /**
   * Skip formatting files. The chart `templates` folder is added to
   * `.prettierignore` either way.
   */
  skipFormat?: boolean;
  [k: string]: unknown;
}
