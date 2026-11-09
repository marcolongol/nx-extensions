import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { ExecutorContext, logger } from '@nx/devkit';

import executor from './executor';
import { ReleasePublishExecutorSchema } from './schema.d';
import { createHelmClient } from '../../utils/helm';

jest.mock('../../utils/helm', () => ({
  createHelmClient: jest.fn(),
}));

const helm = {
  chartExists: jest.fn(),
  addRepository: jest.fn(),
  dependencyUpdate: jest.fn(),
  dependencyBuild: jest.fn(),
  package: jest.fn(),
  push: jest.fn(),
};

describe('Release Publish Executor', () => {
  let root: string;
  let context: ExecutorContext;
  let info: jest.SpyInstance;
  let error: jest.SpyInstance;

  const options = (
    overrides: Partial<ReleasePublishExecutorSchema> = {},
  ): ReleasePublishExecutorSchema => ({
    chartFolder: 'charts/platform',
    outputFolder: 'dist/charts/charts/platform',
    remote: 'oci://ghcr.io/my-org/charts',
    ...overrides,
  });

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'helm-publish-'));
    mkdirSync(path.join(root, 'charts/platform'), { recursive: true });
    writeFileSync(
      path.join(root, 'charts/platform/Chart.yaml'),
      'apiVersion: v2\nname: platform\nversion: 1.4.1\n',
    );
    context = { root, cwd: root, isVerbose: false } as ExecutorContext;

    jest.clearAllMocks();
    jest.mocked(createHelmClient).mockReturnValue(helm as never);
    helm.chartExists.mockResolvedValue(false);
    helm.package.mockResolvedValue(
      path.join(root, 'dist/charts/charts/platform/platform-1.4.1.tgz'),
    );
    info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('packages and pushes a version that is not in the registry yet', async () => {
    await expect(executor(options(), context)).resolves.toEqual({
      success: true,
    });

    expect(helm.chartExists).toHaveBeenCalledWith(
      'oci://ghcr.io/my-org/charts/platform',
      '1.4.1',
      { plainHttp: undefined },
    );
    expect(helm.dependencyBuild).toHaveBeenCalled();
    expect(helm.dependencyUpdate).not.toHaveBeenCalled();
    expect(helm.package).toHaveBeenCalledWith(
      expect.not.objectContaining({ version: expect.anything() }),
    );
    expect(helm.push).toHaveBeenCalledWith({
      chartPath: path.join(
        root,
        'dist/charts/charts/platform/platform-1.4.1.tgz',
      ),
      remote: 'oci://ghcr.io/my-org/charts',
      plainHttp: undefined,
    });
    expect(info).toHaveBeenCalledWith(
      'Published platform@1.4.1 to oci://ghcr.io/my-org/charts',
    );
  });

  it('skips a version that is already in the registry', async () => {
    helm.chartExists.mockResolvedValue(true);

    await expect(executor(options(), context)).resolves.toEqual({
      success: true,
    });

    expect(helm.package).not.toHaveBeenCalled();
    expect(helm.push).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      'Skipped publishing platform@1.4.1: it is already in oci://ghcr.io/my-org/charts',
    );
  });

  it('packages without pushing in a dry run', async () => {
    await executor(options({ dryRun: true }), context);

    expect(helm.package).toHaveBeenCalled();
    expect(helm.push).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      'Would publish platform@1.4.1 to oci://ghcr.io/my-org/charts, but --dry-run was set',
    );
  });

  it('skips charts with publish set to false, without contacting the registry', async () => {
    await expect(
      executor(options({ publish: false }), context),
    ).resolves.toEqual({
      success: true,
    });

    expect(helm.chartExists).not.toHaveBeenCalled();
    expect(helm.package).not.toHaveBeenCalled();
  });

  it('passes plainHttp on and trims a trailing slash from the remote', async () => {
    await executor(
      options({ remote: 'oci://localhost:5000/charts/', plainHttp: true }),
      context,
    );

    expect(helm.chartExists).toHaveBeenCalledWith(
      'oci://localhost:5000/charts/platform',
      '1.4.1',
      { plainHttp: true },
    );
    expect(helm.push).toHaveBeenCalledWith(
      expect.objectContaining({
        remote: 'oci://localhost:5000/charts',
        plainHttp: true,
      }),
    );
  });

  it('fails without an oci:// remote', async () => {
    await expect(
      executor(options({ remote: undefined }), context),
    ).resolves.toEqual({
      success: false,
    });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Can't publish platform@1.4.1: set the remote option",
      ),
    );
    expect(helm.chartExists).not.toHaveBeenCalled();
  });

  it('fails when helm fails', async () => {
    helm.push.mockRejectedValue(
      new Error('helm push failed with exit code 1: denied'),
    );

    await expect(executor(options(), context)).resolves.toEqual({
      success: false,
    });

    expect(error).toHaveBeenCalledWith(
      'helm push failed with exit code 1: denied',
    );
  });
});
