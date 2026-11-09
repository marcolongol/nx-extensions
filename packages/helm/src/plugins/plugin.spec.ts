import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import {
  CreateDependenciesContext,
  CreateNodesContext,
  DependencyType,
  logger,
  ProjectConfiguration,
} from '@nx/devkit';

import {
  createDependencies,
  createNodes,
  createNodesV2,
  HelmPluginOptions,
} from './plugin';

describe('helm plugin', () => {
  let workspaceRoot: string;
  let context: CreateNodesContext;

  const write = (file: string, content: string) => {
    mkdirSync(path.join(workspaceRoot, path.dirname(file)), {
      recursive: true,
    });
    writeFileSync(path.join(workspaceRoot, file), content);
  };
  const chart = (file: string, name: string, extra = '') =>
    write(file, `apiVersion: v2\nname: ${name}\nversion: 0.1.0\n${extra}`);

  const run = async (files: string[], options?: HelmPluginOptions) =>
    Object.fromEntries(
      (await createNodes[1](files, options, context)).map(([file, result]) => [
        file,
        result.projects,
      ]),
    );

  beforeEach(() => {
    workspaceRoot = mkdtempSync(path.join(tmpdir(), 'helm-plugin-'));
    context = { workspaceRoot, nxJsonConfiguration: {} };
  });

  afterEach(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  it('matches every Chart.yaml, under both export names', () => {
    expect(createNodes[0]).toBe('**/Chart.yaml');
    expect(createNodesV2).toBe(createNodes);
  });

  it('creates a chart project with package and push targets', async () => {
    chart('apps/my-app/chart/Chart.yaml', 'my-app');

    const projects = await run(['apps/my-app/chart/Chart.yaml']);

    expect(projects['apps/my-app/chart/Chart.yaml']).toEqual({
      'apps/my-app/chart': {
        name: 'my-app-chart',
        tags: ['helm-chart'],
        metadata: { technologies: ['helm'] },
        targets: {
          'helm-package': {
            executor: '@nx-extensions/helm:package',
            cache: true,
            inputs: ['default', '^default'],
            outputs: ['{options.outputFolder}'],
            options: {
              chartFolder: '{projectRoot}',
              outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
            },
            metadata: { description: 'Package the my-app Helm chart' },
          },
          'helm-push': {
            executor: '@nx-extensions/helm:package',
            options: {
              chartFolder: '{projectRoot}',
              outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
              push: true,
            },
            metadata: {
              description:
                'Package the my-app Helm chart and push it to an OCI registry',
            },
          },
        },
      },
    });
  });

  it('applies the plugin options', async () => {
    chart('charts/platform/Chart.yaml', 'platform');

    const projects = await run(['charts/platform/Chart.yaml'], {
      projectName: 'chart-{chartName}',
      packageTargetName: 'package',
      pushTargetName: 'push',
      outputFolder: '{workspaceRoot}/out/{projectRoot}',
      remote: 'oci://ghcr.io/my-org/charts',
      plainHttp: true,
    });

    const project = projects['charts/platform/Chart.yaml']?.['charts/platform'];
    expect(project?.name).toBe('chart-platform');
    expect(Object.keys(project?.targets ?? {})).toEqual(['package', 'push']);
    expect(project?.targets?.['push'].options).toEqual({
      chartFolder: '{projectRoot}',
      outputFolder: '{workspaceRoot}/out/{projectRoot}',
      push: true,
      remote: 'oci://ghcr.io/my-org/charts',
      plainHttp: true,
    });
  });

  it('treats a charts/ folder at the workspace root as charts, not subcharts', async () => {
    chart('charts/platform/Chart.yaml', 'platform');

    expect(Object.keys(await run(['charts/platform/Chart.yaml']))).toEqual([
      'charts/platform/Chart.yaml',
    ]);
  });

  it('skips vendored subcharts, node_modules and dist', async () => {
    chart('charts/platform/Chart.yaml', 'platform');
    chart('charts/platform/charts/redis/Chart.yaml', 'redis');
    chart('node_modules/some-package/chart/Chart.yaml', 'vendored');
    chart('dist/charts/apps/my-app/Chart.yaml', 'built');

    const projects = await run([
      'charts/platform/Chart.yaml',
      'charts/platform/charts/redis/Chart.yaml',
      'node_modules/some-package/chart/Chart.yaml',
      'dist/charts/apps/my-app/Chart.yaml',
    ]);

    expect(Object.keys(projects)).toEqual(['charts/platform/Chart.yaml']);
  });

  it.each([
    [
      'project.json',
      {
        targets: {
          helm: {
            executor: '@nx-extensions/helm:package',
            options: { chartFolder: 'apps/my-app/chart' },
          },
        },
      },
    ],
    [
      'project.json',
      {
        targets: {
          helm: {
            executor: '@nx-extensions/helm:package',
            options: { chartFolder: '{projectRoot}/chart' },
          },
        },
      },
    ],
    [
      'package.json',
      {
        name: 'my-app',
        nx: {
          targets: {
            helm: {
              executor: '@nx-extensions/helm:package',
              options: { chartFolder: 'apps/my-app/chart' },
            },
          },
        },
      },
    ],
  ])(
    'skips a chart that a generated helm target in %s packages',
    async (file, config) => {
      write(`apps/my-app/${file}`, JSON.stringify(config));
      chart('apps/my-app/chart/Chart.yaml', 'my-app');

      expect(await run(['apps/my-app/chart/Chart.yaml'])).toEqual({});
    },
  );

  it('keeps a chart that the enclosing project does not package', async () => {
    write(
      'apps/my-app/project.json',
      JSON.stringify({ targets: { build: { command: 'echo build' } } }),
    );
    chart('apps/my-app/chart/Chart.yaml', 'my-app');

    expect(Object.keys(await run(['apps/my-app/chart/Chart.yaml']))).toEqual([
      'apps/my-app/chart/Chart.yaml',
    ]);
  });

  it('skips and warns about charts without a name or with invalid YAML', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    write('a/Chart.yaml', 'apiVersion: v2\nversion: 0.1.0\n');
    write('b/Chart.yaml', 'name: [unclosed\n');

    expect(await run(['a/Chart.yaml', 'b/Chart.yaml'])).toEqual({});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('a/Chart.yaml'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('b/Chart.yaml'));
    warn.mockRestore();
  });

  describe('createDependencies', () => {
    const graphContext = (
      projects: Record<string, string>,
    ): CreateDependenciesContext =>
      ({
        workspaceRoot,
        nxJsonConfiguration: {},
        projects: Object.fromEntries(
          Object.entries(projects).map(([name, root]) => [
            name,
            { root } as ProjectConfiguration,
          ]),
        ),
      }) as unknown as CreateDependenciesContext;

    it('links an umbrella to its file:// and oci:// subcharts in the workspace', async () => {
      chart('apps/frontend/chart/Chart.yaml', 'frontend');
      chart('apps/backend/chart/Chart.yaml', 'backend');
      chart(
        'charts/platform/Chart.yaml',
        'platform',
        [
          'dependencies:',
          '  - name: frontend',
          '    version: 0.1.0',
          '    repository: file://../../apps/frontend/chart',
          '  - name: backend',
          '    version: 0.1.0',
          '    repository: oci://ghcr.io/my-org/charts',
          '  - name: redis',
          '    version: 20.0.0',
          '    repository: oci://registry-1.docker.io/bitnamicharts',
          '',
        ].join('\n'),
      );

      const dependencies = await createDependencies(
        undefined,
        graphContext({
          'frontend-chart': 'apps/frontend/chart',
          'backend-chart': 'apps/backend/chart',
          'platform-chart': 'charts/platform',
          frontend: 'apps/frontend',
        }),
      );

      expect(dependencies).toEqual([
        {
          source: 'platform-chart',
          target: 'frontend-chart',
          type: DependencyType.static,
          sourceFile: 'charts/platform/Chart.yaml',
        },
        {
          source: 'platform-chart',
          target: 'backend-chart',
          type: DependencyType.static,
          sourceFile: 'charts/platform/Chart.yaml',
        },
      ]);
    });

    it('links a nested chart to its enclosing project with appVersion: project', async () => {
      chart('apps/frontend/chart/Chart.yaml', 'frontend');
      chart('charts/platform/Chart.yaml', 'platform');
      const projects = {
        'frontend-chart': 'apps/frontend/chart',
        'platform-chart': 'charts/platform',
        frontend: 'apps/frontend',
        apps: 'apps',
      };

      expect(
        await createDependencies(undefined, graphContext(projects)),
      ).toEqual([]);
      expect(
        await createDependencies(
          { appVersion: 'project' },
          graphContext(projects),
        ),
      ).toEqual([
        {
          source: 'frontend-chart',
          target: 'frontend',
          type: DependencyType.implicit,
        },
      ]);
    });

    it('ignores projects without a Chart.yaml', async () => {
      write('apps/frontend/project.json', '{}');

      expect(
        await createDependencies(
          undefined,
          graphContext({ frontend: 'apps/frontend' }),
        ),
      ).toEqual([]);
    });
  });
});
