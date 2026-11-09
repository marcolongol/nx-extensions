/**
 * Options of the `@nx-extensions/helm:umbrella` generator; keep in sync with
 * schema.json.
 */
export interface UmbrellaGeneratorSchema {
  /** Name of the umbrella chart. */
  name: string;
  /** Chart projects to bundle as file:// subcharts. */
  charts: string[];
  /** Folder for the umbrella chart. Defaults to `charts/{name}`. */
  directory?: string;
  /** Keep publishing the bundled charts on their own. Defaults to true. */
  publishSubcharts?: boolean;
  /** Skip formatting the updated files. */
  skipFormat?: boolean;
}
