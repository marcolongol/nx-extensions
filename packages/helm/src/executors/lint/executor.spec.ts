import { ExecutorContext, logger } from '@nx/devkit';

import lint from './executor';
import { createHelmClient } from '../../utils/helm';
import template from '../template/executor';

jest.mock('../../utils/helm', () => ({
  createHelmClient: jest.fn(),
}));

const helm = {
  addRepository: jest.fn(),
  dependencyUpdate: jest.fn(),
  dependencyBuild: jest.fn(),
  lint: jest.fn(),
  template: jest.fn(),
};

const context = { root: '/workspace' } as ExecutorContext;

describe('lint and template executors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createHelmClient).mockReturnValue(helm as never);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  });

  it('should build dependencies, then lint', async () => {
    const result = await lint(
      {
        chartFolder: 'charts/platform',
        values: ['values-prod.yaml'],
        strict: true,
        plainHttp: true,
      },
      context,
    );

    expect(result).toEqual({ success: true });
    expect(helm.dependencyBuild).toHaveBeenCalledWith(
      '/workspace/charts/platform',
      { plainHttp: true },
    );
    expect(helm.dependencyUpdate).not.toHaveBeenCalled();
    expect(helm.lint).toHaveBeenCalledWith('/workspace/charts/platform', {
      strict: true,
      values: ['/workspace/charts/platform/values-prod.yaml'],
    });
    expect(helm.dependencyBuild.mock.invocationCallOrder[0]).toBeLessThan(
      helm.lint.mock.invocationCallOrder[0],
    );
  });

  it('should add https repositories before building dependencies', async () => {
    await lint(
      {
        chartFolder: 'charts/platform',
        repositories: [{ name: 'example', url: 'https://charts.example.com' }],
      },
      context,
    );

    expect(helm.addRepository).toHaveBeenCalledWith(
      'example',
      'https://charts.example.com',
      { username: undefined, password: undefined },
    );
  });

  it('should skip building dependencies with buildDependencies false', async () => {
    await template(
      { chartFolder: 'charts/platform', buildDependencies: false },
      context,
    );

    expect(helm.dependencyBuild).not.toHaveBeenCalled();
    expect(helm.template).toHaveBeenCalledWith('/workspace/charts/platform', {
      values: [],
    });
  });

  it('should fail when the chart does not render', async () => {
    helm.template.mockRejectedValueOnce(new Error('parse error in deployment'));

    await expect(
      template({ chartFolder: 'charts/platform' }, context),
    ).resolves.toEqual({ success: false });
    expect(logger.error).toHaveBeenCalledWith('parse error in deployment');
  });

  it.each([
    ['chartFolder', { chartFolder: '../outside' }],
    ['values', { chartFolder: 'charts/platform', values: ['../../../etc/x'] }],
  ])('should reject a %s outside the workspace', async (_, options) => {
    await expect(lint(options, context)).resolves.toEqual({ success: false });
    expect(helm.lint).not.toHaveBeenCalled();
  });
});
