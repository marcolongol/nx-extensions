import { logger } from '@nx/devkit';

import { checkRepositoryUrl } from './repository';

describe('checkRepositoryUrl', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['https://charts.example.com', 'https'],
    ['oci://registry.example.com/charts', 'oci'],
    ['file://../shared-chart', 'file'],
  ])('accepts %s as %s', (url, kind) => {
    expect(checkRepositoryUrl(url)).toBe(kind);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts plain HTTP with a warning', () => {
    expect(checkRepositoryUrl('http://charts.internal')).toBe('http');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('plain HTTP'));
  });

  it('rejects credentials without repeating them', () => {
    expect(() =>
      checkRepositoryUrl('https://ci:s3cret@charts.example.com/x'),
    ).toThrow(
      'Repository URL "https://***@charts.example.com/x" contains credentials',
    );
  });

  it.each(['not a url', 'ftp://charts.example.com'])('rejects %s', (url) => {
    expect(() => checkRepositoryUrl(url)).toThrow();
  });
});
