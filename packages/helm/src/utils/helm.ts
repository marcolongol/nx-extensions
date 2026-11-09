import { CommandError, runCommand } from '@nx-extensions/core';

export interface PackageOptions {
  chartFolder: string;
  outputFolder: string;
  version?: string;
  appVersion?: string;
}

export interface PushOptions {
  chartPath: string;
  remote: string;
  plainHttp?: boolean;
}

export interface HelmClientOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Thin wrapper around the helm CLI.
 *
 * Every command puts its flags first, then `--`, then the positional arguments,
 * so a value starting with `-` (a chart folder, remote or repository) can never
 * be read as a flag. Flags after `--` would be ignored or misread by helm.
 */
export class HelmClient {
  constructor(private readonly options: HelmClientOptions = {}) {}

  /**
   * Packages a chart directory into a chart archive.
   *
   * @returns {Promise<string>} The path of the packaged chart
   */
  async package(options: PackageOptions): Promise<string> {
    const { stdout } = await this.helm(
      ['package'],
      [
        '--destination',
        options.outputFolder,
        ...(options.version ? ['--version', options.version] : []),
        ...(options.appVersion ? ['--app-version', options.appVersion] : []),
      ],
      [options.chartFolder],
    );

    const match = stdout.match(
      /Successfully packaged chart and saved it to: (.+)/,
    );
    if (!match) {
      throw new Error('Could not find the packaged chart path in helm output');
    }
    return match[1].trim();
  }

  async push(options: PushOptions): Promise<void> {
    await this.helm(['push'], options.plainHttp ? ['--plain-http'] : [], [
      options.chartPath,
      options.remote,
    ]);
  }

  /**
   * Whether a chart version exists in an OCI registry, e.g.
   * `oci://ghcr.io/my-org/charts/my-chart` at `1.2.0`. Any failure, such as the
   * version not being there, counts as not existing.
   */
  async chartExists(
    reference: string,
    version: string,
    options: { plainHttp?: boolean } = {},
  ): Promise<boolean> {
    try {
      await runCommand(
        'helm',
        [
          'show',
          'chart',
          '--version',
          version,
          ...(options.plainHttp ? ['--plain-http'] : []),
          '--',
          reference,
        ],
        { cwd: this.options.cwd, env: this.options.env, silent: true },
      );
      return true;
    } catch (error) {
      if (error instanceof CommandError) {
        return false;
      }
      throw error;
    }
  }

  async dependencyUpdate(
    chartFolder: string,
    options: { plainHttp?: boolean } = {},
  ): Promise<void> {
    await this.helm(
      ['dependency', 'update'],
      options.plainHttp ? ['--plain-http'] : [],
      [chartFolder],
    );
  }

  async dependencyBuild(
    chartFolder: string,
    options: { plainHttp?: boolean } = {},
  ): Promise<void> {
    await this.helm(
      ['dependency', 'build'],
      options.plainHttp ? ['--plain-http'] : [],
      [chartFolder],
    );
  }

  /** Runs `helm lint`, which prints its findings. */
  async lint(
    chartFolder: string,
    options: { strict?: boolean; values?: string[] } = {},
  ): Promise<void> {
    await this.helm(
      ['lint'],
      [...(options.strict ? ['--strict'] : []), ...valuesFlags(options.values)],
      [chartFolder],
    );
  }

  /**
   * Renders the chart with `helm template` to check that it renders. The
   * manifests are not printed; a failure includes helm's error.
   */
  async template(
    chartFolder: string,
    options: { values?: string[] } = {},
  ): Promise<void> {
    await runCommand(
      'helm',
      ['template', ...valuesFlags(options.values), '--', chartFolder],
      { cwd: this.options.cwd, env: this.options.env, silent: true },
    );
  }

  /**
   * Adds or updates a chart repository. `--force-update` keeps the entry in
   * line with the URL in the project configuration. The password goes through
   * stdin, so it never shows up in the command line or logs.
   */
  async addRepository(
    name: string,
    url: string,
    credentials: { username?: string; password?: string } = {},
  ): Promise<void> {
    await this.helm(
      ['repo', 'add'],
      [
        '--force-update',
        ...(credentials.username ? ['--username', credentials.username] : []),
        ...(credentials.password ? ['--password-stdin'] : []),
      ],
      [name, url],
      credentials.password,
    );
  }

  private helm(
    command: string[],
    flags: string[],
    positionals: string[],
    input?: string,
  ) {
    return runCommand('helm', [...command, ...flags, '--', ...positionals], {
      cwd: this.options.cwd,
      env: this.options.env,
      input,
    });
  }
}

function valuesFlags(values: string[] = []): string[] {
  return values.flatMap((file) => ['--values', file]);
}

export const createHelmClient = (options?: HelmClientOptions): HelmClient =>
  new HelmClient(options);
