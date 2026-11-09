import path from 'node:path';

import { ExecutorContext } from '@nx/devkit';
import { createHelmClient } from '@nx-extensions/core';

import executor from './executor';
import { PackageExecutorSchema } from './schema.d';

jest.mock('@nx-extensions/core', () => ({
  ...jest.requireActual('@nx-extensions/core'),
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

describe('Package Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createHelmClient).mockReturnValue(helm as never);
    helm.package.mockResolvedValue('/workspace/dist/my-chart-0.1.0.tgz');
  });

  it('packages the chart with paths resolved against the workspace root', async () => {
    const output = await executor(
      options({ version: '1.2.3', appVersion: '4.5.6' }),
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

  it('works without a dependencies block, using the schema defaults', async () => {
    await executor(options({ dependencies: undefined }), context);

    expect(helm.addRepository).not.toHaveBeenCalled();
    expect(helm.dependencyUpdate).toHaveBeenCalledWith(
      path.join(root, 'apps/my-app/chart'),
    );
    expect(helm.dependencyBuild).not.toHaveBeenCalled();
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
        dependencies: {
          update: true,
          build: true,
          repositories: [{ name: 'example', url: 'https://example.com' }],
        },
      }),
      context,
    );

    expect(helm.addRepository).toHaveBeenCalledWith(
      'example',
      'https://example.com',
    );
    expect(calls).toEqual(['repo', 'update', 'build', 'package']);
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

  it.each([undefined, 'https://example.com/charts'])(
    'rejects push with remote %s before running helm',
    async (remote) => {
      await expect(
        executor(options({ push: true, remote }), context),
      ).rejects.toThrow('remote must be an oci:// registry URL');
      expect(helm.package).not.toHaveBeenCalled();
    },
  );

  it('rejects repositories without a name or url', async () => {
    await expect(
      executor(
        options({ dependencies: { repositories: [{ name: 'example' }] } }),
        context,
      ),
    ).rejects.toThrow('needs a name and a url');
    expect(helm.addRepository).not.toHaveBeenCalled();
  });

  it('rejects a chartFolder outside the workspace', async () => {
    await expect(
      executor(options({ chartFolder: '../outside/chart' }), context),
    ).rejects.toThrow('chartFolder "../outside/chart" must be inside');
  });

  it('rejects a relative outputFolder outside the workspace', async () => {
    await expect(
      executor(options({ outputFolder: '../../tmp/out' }), context),
    ).rejects.toThrow('outputFolder "../../tmp/out" must be inside');
  });

  it('accepts an absolute outputFolder outside the workspace', async () => {
    await executor(options({ outputFolder: '/runner/temp/charts' }), context);

    expect(helm.package).toHaveBeenCalledWith(
      expect.objectContaining({ outputFolder: '/runner/temp/charts' }),
    );
  });
});
