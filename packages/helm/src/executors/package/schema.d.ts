/** Options of the `@nx-extensions/helm:package` executor; see schema.json. */

export interface HelmRepository {
  /** Name of the repository. */
  name: string;
  /**
   * URL of the repository (https://, http://, oci:// or file://). Must not
   * contain credentials; use username and passwordEnv.
   */
  url: string;
  /** Username for a repository that needs authentication. */
  username?: string;
  /**
   * Name of the environment variable that holds the repository password. It is
   * passed to helm through stdin, never on the command line.
   */
  passwordEnv?: string;
}

export interface PackageExecutorSchema {
  /** Folder of the chart, relative to the workspace root. */
  chartFolder: string;
  /** Folder for the packaged chart, relative to the workspace root or absolute. */
  outputFolder: string;
  /** Overrides the chart version when packaging (`helm package --version`). */
  chartVersion?: string;
  /** Overrides the app version when packaging (`helm package --app-version`). */
  appVersion?: string;
  /** Push the packaged chart to `remote`. */
  push?: boolean;
  /** OCI registry to push the chart to. Required when `push` is set. */
  remote?: string;
  /**
   * Use plain HTTP instead of TLS for OCI registries: when pushing the chart
   * and when downloading OCI dependencies.
   */
  plainHttp?: boolean;
  /** Run `helm dependency update` before packaging. Defaults to false. */
  updateDependencies?: boolean;
  /** Run `helm dependency build` before packaging. Defaults to true. */
  buildDependencies?: boolean;
  /**
   * Chart repositories to add with `helm repo add` before handling
   * dependencies.
   */
  repositories?: HelmRepository[];
}
