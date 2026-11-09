import { runCommand } from '@nx-extensions/core';

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

export const createHelmClient = (options?: HelmClientOptions): HelmClient =>
  new HelmClient(options);
