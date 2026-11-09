import { enclosingProjectName, resolveChartProjectName } from './project-name';

const files =
  (contents: Record<string, string>) =>
  (file: string): string | null =>
    contents[file] ?? null;

describe('chart project names', () => {
  it('takes the name from project.json, then package.json', () => {
    const read = files({
      'apps/a/project.json': '{"name":"from-project-json"}',
      'apps/a/package.json': '{"name":"from-package-json"}',
      'apps/b/package.json': '{"name":"@org/b"}',
    });

    expect(enclosingProjectName('apps/a/chart', read)).toBe(
      'from-project-json',
    );
    expect(enclosingProjectName('apps/b/deploy/chart', read)).toBe('@org/b');
  });

  it('falls back to the folder name like Nx', () => {
    expect(
      enclosingProjectName(
        'apps/web/chart',
        files({ 'apps/web/project.json': '{}' }),
      ),
    ).toBe('web');
  });

  it('ignores the chart folder itself and the workspace root', () => {
    const read = files({
      'package.json': '{"name":"@org/source"}',
      'charts/platform/project.json': '{"name":"platform-chart"}',
    });

    expect(enclosingProjectName('charts/platform', read)).toBeUndefined();
  });

  it('fills in both placeholders', () => {
    const read = files({ 'apps/web.app/package.json': '{"name":"web.app"}' });

    expect(
      resolveChartProjectName(
        '{projectName}-chart',
        'web-app',
        'apps/web.app/chart',
        read,
      ),
    ).toBe('web.app-chart');
    expect(
      resolveChartProjectName(
        '{projectName}-{chartName}',
        'platform',
        'charts/platform',
        read,
      ),
    ).toBe('platform-platform');
    expect(
      resolveChartProjectName('{chartName}-chart', 'web-app', 'x/chart', () => {
        throw new Error('not read without {projectName}');
      }),
    ).toBe('web-app-chart');
  });
});
