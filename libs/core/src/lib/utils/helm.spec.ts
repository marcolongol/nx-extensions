import { getExecOutput } from '@actions/exec';

import { createHelmClient } from './helm';

jest.mock('@actions/exec', () => ({
  getExecOutput: jest.fn(),
}));

const mockedGetExecOutput = jest.mocked(getExecOutput);

describe('HelmClient.push', () => {
  beforeEach(() => {
    mockedGetExecOutput.mockReset();
    mockedGetExecOutput.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
  });

  it('pushes over TLS by default', async () => {
    await createHelmClient().push({
      chartPath: 'dist/my-chart-0.1.0.tgz',
      remote: 'oci://localhost:5000/helm-charts',
    });

    expect(mockedGetExecOutput).toHaveBeenLastCalledWith('helm', [
      'push',
      'dist/my-chart-0.1.0.tgz',
      'oci://localhost:5000/helm-charts',
    ]);
  });

  it('passes --plain-http when plainHttp is set', async () => {
    await createHelmClient().push({
      chartPath: 'dist/my-chart-0.1.0.tgz',
      remote: 'oci://localhost:5000/helm-charts',
      plainHttp: true,
    });

    expect(mockedGetExecOutput).toHaveBeenLastCalledWith('helm', [
      'push',
      'dist/my-chart-0.1.0.tgz',
      'oci://localhost:5000/helm-charts',
      '--plain-http',
    ]);
  });
});
