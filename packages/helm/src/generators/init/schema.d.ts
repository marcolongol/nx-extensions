/**
 * Options of the `@nx-extensions/helm:init` generator; keep in sync with
 * schema.json.
 */
export interface InitGeneratorSchema {
  /** OCI registry the chart projects push to. */
  remote?: string;
  /** Use plain HTTP for an OCI registry without TLS. */
  plainHttp?: boolean;
  /** `project`: a chart follows the version of the project it is in. */
  appVersion?: 'none' | 'project';
  /** Add a `charts` release group to nx.json. */
  release?: boolean;
  /** Skip formatting the updated files. */
  skipFormat?: boolean;
}
