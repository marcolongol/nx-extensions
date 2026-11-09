import { runCommand } from '@nx-extensions/core';

import { HelmClient } from './helm';

jest.mock('@nx-extensions/core', () => ({
  ...jest.requireActual('@nx-extensions/core'),
  runCommand: jest.fn(),
}));

const run = jest.mocked(runCommand);

const argsOf = () => run.mock.lastCall?.[1] ?? [];

describe('HelmClient', () => {
  const env = { PATH: '/usr/bin', HELM_REPOSITORY_CONFIG: '/x/repos.yaml' };
  const helm = new HelmClient({ cwd: '/workspace', env });

  beforeEach(() => {
    run.mockReset();
    run.mockResolvedValue({
      stdout:
        'Successfully packaged chart and saved it to: /workspace/dist/my-chart-0.1.0.tgz\n',
      stderr: '',
    });
  });

  it('passes cwd and env to the runner', async () => {
    await helm.push({ chartPath: 'chart.tgz', remote: 'oci://r/charts' });

    expect(run).toHaveBeenCalledWith('helm', expect.any(Array), {
      cwd: '/workspace',
      env,
      input: undefined,
    });
  });

  it('packages a chart and returns its path', async () => {
    await expect(
      helm.package({
        chartFolder: '/workspace/apps/my-app/chart',
        outputFolder: '/workspace/dist',
        version: '1.2.3',
        appVersion: '4.5.6',
      }),
    ).resolves.toBe('/workspace/dist/my-chart-0.1.0.tgz');

    expect(argsOf()).toEqual([
      'package',
      '--destination',
      '/workspace/dist',
      '--version',
      '1.2.3',
      '--app-version',
      '4.5.6',
      '--',
      '/workspace/apps/my-app/chart',
    ]);
  });

  it('fails when helm output has no chart path', async () => {
    run.mockResolvedValue({ stdout: 'something else', stderr: '' });

    await expect(
      helm.package({ chartFolder: 'chart', outputFolder: 'dist' }),
    ).rejects.toThrow('Could not find the packaged chart path');
  });

  it('pushes with --plain-http before the positionals', async () => {
    await helm.push({
      chartPath: 'chart.tgz',
      remote: 'oci://localhost:5000/charts',
      plainHttp: true,
    });

    expect(argsOf()).toEqual([
      'push',
      '--plain-http',
      '--',
      'chart.tgz',
      'oci://localhost:5000/charts',
    ]);
  });

  it('adds a repository with --force-update', async () => {
    await helm.addRepository('example', 'https://charts.example.com');

    expect(argsOf()).toEqual([
      'repo',
      'add',
      '--force-update',
      '--',
      'example',
      'https://charts.example.com',
    ]);
  });

  it('sends the repository password through stdin', async () => {
    await helm.addRepository('private', 'https://charts.example.com', {
      username: 'ci',
      password: 's3cret',
    });

    expect(argsOf()).toEqual([
      'repo',
      'add',
      '--force-update',
      '--username',
      'ci',
      '--password-stdin',
      '--',
      'private',
      'https://charts.example.com',
    ]);
    expect(run.mock.lastCall?.[2]).toMatchObject({ input: 's3cret' });
  });

  it.each([
    [
      'package',
      () =>
        helm.package({
          chartFolder: '-chart',
          outputFolder: 'dist',
          version: '1.0.0',
          appVersion: '2.0.0',
        }),
    ],
    [
      'push',
      () =>
        helm.push({ chartPath: '-x.tgz', remote: '-remote', plainHttp: true }),
    ],
    [
      'dependency update',
      () => helm.dependencyUpdate('-chart', { plainHttp: true }),
    ],
    [
      'dependency build',
      () => helm.dependencyBuild('-chart', { plainHttp: true }),
    ],
    ['repo add', () => helm.addRepository('-name', '-url')],
  ])(
    '%s puts every flag before -- and every value after it',
    async (_name, call) => {
      await call();

      const args = argsOf();
      const separator = args.indexOf('--');
      expect(separator).toBeGreaterThan(0);
      // Positionals that look like flags sit safely after the separator
      expect(
        args.slice(separator + 1).every((arg) => arg.startsWith('-')),
      ).toBe(true);
      // Nothing after the separator is one of helm's own flags
      expect(
        args.slice(separator + 1).some((arg) => arg.startsWith('--')),
      ).toBe(false);
    },
  );
});
