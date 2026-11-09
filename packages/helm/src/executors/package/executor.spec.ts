import * as path from 'node:path';

import { ExecutorContext, logger } from '@nx/devkit';

import executor from './executor';
import { PackageExecutorSchema } from './schema.d';
import { createHelmClient } from '../../utils/helm';

jest.mock('../../utils/helm', () => ({
  createHelmClient: jest.fn(),
}));

const root = path.resolve('/workspace');

const context = {
  root,
  cwd: path.join(root, 'apps', 'my-app'),
  isVerbose: false,
  projectsConfigurations: { version: 2, projects: {} },
  nxJsonConfiguration: {},
  projectGraph: { nodes: {}, dependencies: {} },
} as ExecutorContext;

const helm = {
  addRepository: jest.fn(),
  dependencyUpdate: jest.fn(),
  dependencyBuild: jest.fn(),
  package: jest.fn(),
  push: jest.fn(),
};

const options = (
  overrides: Partial<PackageExecutorSchema> = {},
): PackageExecutorSchema => ({
  chartFolder: 'apps/my-app/chart',
  outputFolder: 'dist/charts/apps/my-app',
  ...overrides,
});

const repositories = (
  ...entries: NonNullable<PackageExecutorSchema['repositories']>
) => options({ repositories: entries });

describe('Package Executor', () => {
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createHelmClient).mockReturnValue(helm as never);
    helm.package.mockResolvedValue('/workspace/dist/my-chart-0.1.0.tgz');
    error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env['HELM_REPOSITORY_CONFIG'];
    delete process.env['E2E_REPO_PASSWORD'];
  });

  /**
   * Runs the executor and expects it to fail with a message containing
   * `message`.
   */
  const expectFailure = async (
    executorOptions: PackageExecutorSchema,
    message: string,
  ) => {
    await expect(executor(executorOptions, context)).resolves.toEqual({
      success: false,
    });
    expect(error).toHaveBeenCalledWith(expect.stringContaining(message));
  };

  it('packages the chart with paths resolved against the workspace root', async () => {
    const output = await executor(
      options({ chartVersion: '1.2.3', appVersion: '4.5.6' }),
      context,
    );

    expect(output.success).toBe(true);
    expect(helm.package).toHaveBeenCalledWith({
      chartFolder: path.join(root, 'apps/my-app/chart'),
      outputFolder: path.join(root, 'dist/charts/apps/my-app'),
      version: '1.2.3',
      appVersion: '4.5.6',
    });
    expect(helm.push).not.toHaveBeenCalled();
  });

  it('keeps added repositories out of the global Helm config', async () => {
    await executor(options(), context);

    const cache = path.join(root, 'node_modules/.cache/@nx-extensions/helm');
    expect(createHelmClient).toHaveBeenCalledWith({
      env: expect.objectContaining({
        HELM_REPOSITORY_CONFIG: path.join(cache, 'repositories.yaml'),
        HELM_REPOSITORY_CACHE: path.join(cache, 'repository-cache'),
      }),
    });
  });

  it('respects a HELM_REPOSITORY_CONFIG set by the user', async () => {
    process.env['HELM_REPOSITORY_CONFIG'] = '/home/me/repositories.yaml';

    await executor(options(), context);

    expect(createHelmClient).toHaveBeenCalledWith({
      env: expect.objectContaining({
        HELM_REPOSITORY_CONFIG: '/home/me/repositories.yaml',
      }),
    });
  });

  it('builds dependencies but does not update them by default', async () => {
    await executor(options(), context);

    expect(helm.addRepository).not.toHaveBeenCalled();
    expect(helm.dependencyUpdate).not.toHaveBeenCalled();
    expect(helm.dependencyBuild).toHaveBeenCalledWith(
      path.join(root, 'apps/my-app/chart'),
      { plainHttp: undefined },
    );
  });

  it('adds repositories and updates and builds dependencies before packaging', async () => {
    const calls: string[] = [];
    helm.addRepository.mockImplementation(async () => calls.push('repo'));
    helm.dependencyUpdate.mockImplementation(async () => calls.push('update'));
    helm.dependencyBuild.mockImplementation(async () => calls.push('build'));
    helm.package.mockImplementation(async () => {
      calls.push('package');
      return '/workspace/dist/my-chart-0.1.0.tgz';
    });

    await executor(
      options({
        plainHttp: true,
        updateDependencies: true,
        buildDependencies: true,
        repositories: [{ name: 'example', url: 'https://example.com' }],
      }),
      context,
    );

    expect(helm.addRepository).toHaveBeenCalledWith(
      'example',
      'https://example.com',
      { username: undefined, password: undefined },
    );
    expect(helm.dependencyBuild).toHaveBeenCalledWith(
      path.join(root, 'apps/my-app/chart'),
      { plainHttp: true },
    );
    expect(calls).toEqual(['repo', 'update', 'build', 'package']);
  });

  it('does not add oci:// or file:// repositories', async () => {
    await executor(
      repositories(
        { name: 'registry', url: 'oci://registry.example.com/charts' },
        { name: 'local', url: 'file://../shared-chart' },
      ),
      context,
    );

    expect(helm.addRepository).not.toHaveBeenCalled();
  });

  it('reads the repository password from passwordEnv', async () => {
    process.env['E2E_REPO_PASSWORD'] = 's3cret';

    await executor(
      repositories({
        name: 'private',
        url: 'https://charts.example.com',
        username: 'ci',
        passwordEnv: 'E2E_REPO_PASSWORD',
      }),
      context,
    );

    expect(helm.addRepository).toHaveBeenCalledWith(
      'private',
      'https://charts.example.com',
      { username: 'ci', password: 's3cret' },
    );
  });

  it('fails when the passwordEnv variable is not set', async () => {
    await expectFailure(
      repositories({
        name: 'private',
        url: 'https://charts.example.com',
        passwordEnv: 'E2E_REPO_PASSWORD',
      }),
      'Environment variable E2E_REPO_PASSWORD for the password of repository "private" is not set.',
    );
    expect(helm.addRepository).not.toHaveBeenCalled();
  });

  it('rejects credentials in a repository URL without logging them', async () => {
    await expectFailure(
      repositories({
        name: 'private',
        url: 'https://ci:s3cret@charts.example.com',
      }),
      'contains credentials',
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('s3cret');
  });

  it('warns about plain HTTP repositories', async () => {
    await executor(
      repositories({ name: 'internal', url: 'http://charts.internal' }),
      context,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('plain HTTP'));
    expect(helm.addRepository).toHaveBeenCalled();
  });

  it('pushes the packaged chart to the remote', async () => {
    await executor(
      options({
        push: true,
        remote: 'oci://localhost:5000/charts',
        plainHttp: true,
      }),
      context,
    );

    expect(helm.push).toHaveBeenCalledWith({
      chartPath: '/workspace/dist/my-chart-0.1.0.tgz',
      remote: 'oci://localhost:5000/charts',
      plainHttp: true,
    });
  });

  it('fails when helm fails', async () => {
    helm.package.mockRejectedValue(
      new Error('helm package failed with exit code 1: no Chart.yaml'),
    );

    await expectFailure(options(), 'failed with exit code 1: no Chart.yaml');
  });

  it.each([undefined, 'https://example.com/charts'])(
    'rejects push with remote %s before running helm',
    async (remote) => {
      await expectFailure(
        options({ push: true, remote }),
        'remote must be an oci:// registry URL',
      );
      expect(helm.package).not.toHaveBeenCalled();
    },
  );

  it('rejects repositories without a name or url', async () => {
    await expectFailure(
      repositories({ name: 'example' } as never),
      'needs a name and a url',
    );
    expect(helm.addRepository).not.toHaveBeenCalled();
  });

  it('rejects a chartFolder outside the workspace', async () => {
    await expectFailure(
      options({ chartFolder: '../outside/chart' }),
      'chartFolder "../outside/chart" must be inside',
    );
  });

  it('rejects a relative outputFolder outside the workspace', async () => {
    await expectFailure(
      options({ outputFolder: '../../tmp/out' }),
      'outputFolder "../../tmp/out" must be inside',
    );
  });

  it('accepts an absolute outputFolder outside the workspace', async () => {
    await executor(options({ outputFolder: '/runner/temp/charts' }), context);

    expect(helm.package).toHaveBeenCalledWith(
      expect.objectContaining({ outputFolder: '/runner/temp/charts' }),
    );
  });
});
