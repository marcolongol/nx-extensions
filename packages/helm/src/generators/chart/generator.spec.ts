import {
  Tree,
  addProjectConfiguration,
  formatFiles,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { chartGenerator, toChartName } from './generator';
import { ChartGeneratorSchema } from './schema.d';
import { registerHelmPlugin } from '../../utils/workspace';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: jest.fn(),
}));

const formatFilesSpy = jest.mocked(formatFiles);

describe('chart generator', () => {
  let tree: Tree;
  let options: ChartGeneratorSchema;

  beforeAll(async () => {
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);

    options = {
      name: 'test-chart',
      project: 'test-project',
      chartFolder: 'chart',
      skipFormat: true,
    };

    addProjectConfiguration(tree, options.project, {
      root: `apps/${options.project}`,
    });

    await chartGenerator(tree, options);
  });

  it('should run successfully', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(projectConfig).toBeDefined();
  });

  it('should create the chart', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    expect(tree.exists(`${projectConfig.root}/chart/Chart.yaml`)).toBe(true);
  });

  it('should create the Gateway API HTTPRoute template', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    const chart = `${projectConfig.root}/chart`;

    expect(tree.read(`${chart}/templates/httproute.yaml`, 'utf8')).toContain(
      'apiVersion: gateway.networking.k8s.io/v1',
    );
    expect(tree.read(`${chart}/values.yaml`, 'utf8')).toContain('httpRoute:');
  });

  it('should name the template helpers after the chart', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    const templates = `${projectConfig.root}/chart/templates`;

    expect(tree.read(`${templates}/_helpers.tpl`, 'utf8')).toContain(
      '{{- define "test-chart.fullname" -}}',
    );
    expect(tree.read(`${templates}/deployment.yaml`, 'utf8')).toContain(
      '{{ include "test-chart.fullname" . }}',
    );
    expect(tree.read(`${templates}/_helpers.tpl`, 'utf8')).not.toContain(
      '"chart.',
    );
  });

  it('should only use the networking.k8s.io/v1 Ingress API', async () => {
    const projectConfig = readProjectConfiguration(tree, options.project);
    const ingress = tree.read(
      `${projectConfig.root}/chart/templates/ingress.yaml`,
      'utf8',
    );

    expect(ingress).toContain('apiVersion: networking.k8s.io/v1');
    expect(ingress).not.toContain('v1beta1');
  });

  it('should add the chart templates to .prettierignore', async () => {
    expect(tree.read('.prettierignore', 'utf8')).toContain(
      '/apps/test-project/chart/templates\n',
    );
  });

  it('should create the chart in a folder relative to the project root', async () => {
    const customOptions = {
      ...options,
      project: 'test-project-custom-folder',
      chartFolder: 'custom-folder',
    };
    addProjectConfiguration(tree, customOptions.project, {
      root: `apps/${customOptions.project}`,
    });

    await chartGenerator(tree, customOptions);

    expect(
      tree.exists('apps/test-project-custom-folder/custom-folder/Chart.yaml'),
    ).toBe(true);
  });

  it.each([
    ['escape-sibling', '../other'],
    ['escape-workspace', '../../../outside'],
    ['escape-absolute', '/etc/chart'],
  ])(
    'should reject chartFolder for %s outside the project root',
    async (project, chartFolder) => {
      addProjectConfiguration(tree, project, { root: `apps/${project}` });

      await expect(
        chartGenerator(tree, {
          ...options,
          project,
          chartFolder,
        }),
      ).rejects.toThrow('must be a path inside the project root');
    },
  );
});

describe('chart generator chart project', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);
    addProjectConfiguration(tree, 'my-app', { root: 'apps/my-app' });
    await chartGenerator(tree, {
      name: 'my-app',
      project: 'my-app',
      skipFormat: true,
    });
  });

  it('should create the chart without a helm target', () => {
    expect(tree.exists('apps/my-app/chart/Chart.yaml')).toBe(true);
    expect(
      readProjectConfiguration(tree, 'my-app').targets?.['helm'],
    ).toBeUndefined();
  });

  it('should ignore packaged dependencies', () => {
    expect(tree.read('.gitignore', 'utf8')).toContain(
      '/apps/my-app/chart/charts/*.tgz\n',
    );
  });

  it('should need the plugin', async () => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', { root: 'apps/my-app' });

    await expect(
      chartGenerator(tree, {
        name: 'my-app',
        project: 'my-app',
        skipFormat: true,
      }),
    ).rejects.toThrow('nx add @nx-extensions/helm');
  });

  it.each([
    ['my-api', 'my-api'],
    ['@org/my-web', 'my-web'],
  ])(
    'should name the chart after the project %s without a name',
    async (project, chartName) => {
      addProjectConfiguration(tree, project, { root: `apps/${chartName}` });

      await chartGenerator(tree, { project, skipFormat: true });

      expect(tree.read(`apps/${chartName}/chart/Chart.yaml`, 'utf8')).toContain(
        `name: ${chartName}\n`,
      );
    },
  );

  it('should not overwrite an existing chart', async () => {
    await expect(
      chartGenerator(tree, {
        name: 'other',
        project: 'my-app',
        skipFormat: true,
      }),
    ).rejects.toThrow('already has a Chart.yaml');
  });
});

describe('chart generator formatting', () => {
  let tree: Tree;

  beforeEach(() => {
    formatFilesSpy.mockClear();
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);
    addProjectConfiguration(tree, 'my-app', { root: 'apps/my-app' });
  });

  // Prettier 3 cannot be imported inside jest's CommonJS VM, so these check
  // that the generator formats, not the formatter output (covered by e2e).
  it('should format the generated files', async () => {
    await chartGenerator(tree, { name: 'my-app', project: 'my-app' });

    expect(formatFilesSpy).toHaveBeenCalledWith(tree);
  });

  it('should keep the templates away from the formatter', async () => {
    const deployment = 'apps/my-app/chart/templates/deployment.yaml';
    formatFilesSpy.mockImplementationOnce(async (formatted) => {
      // Older devkits format every changed file, ignoring .prettierignore
      expect(formatted.exists(deployment)).toBe(false);
      expect(formatted.exists('apps/my-app/chart/values.yaml')).toBe(true);
    });

    await chartGenerator(tree, { name: 'my-app', project: 'my-app' });

    expect(formatFilesSpy).toHaveBeenCalled();
    expect(tree.read(deployment, 'utf8')).toContain(
      '{{- include "my-app.labels" . | nindent 4 }}',
    );
  });

  it('should not format with skipFormat', async () => {
    await chartGenerator(tree, {
      name: 'my-app',
      project: 'my-app',
      skipFormat: true,
    });

    expect(formatFilesSpy).not.toHaveBeenCalled();
  });
});

describe('chart name', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    registerHelmPlugin(tree);
  });

  it.each([
    ['marcolongo.dev', 'marcolongo-dev'],
    ['@org/my-app', 'org-my-app'],
    ['My_App', 'my-app'],
    ['my-app', 'my-app'],
  ])('should turn "%s" into "%s"', (name, expected) => {
    expect(toChartName(name)).toBe(expected);
  });

  it('should reject names without valid characters', () => {
    expect(() => toChartName('...')).toThrow(
      'Cannot derive a valid chart name from "...".',
    );
  });

  it('should write the sanitized name to Chart.yaml', async () => {
    addProjectConfiguration(tree, 'marcolongo.dev', {
      root: 'apps/marcolongo.dev',
    });

    await chartGenerator(tree, {
      name: 'marcolongo.dev',
      project: 'marcolongo.dev',
      skipFormat: true,
    });

    expect(tree.read('apps/marcolongo.dev/chart/Chart.yaml', 'utf8')).toContain(
      'name: marcolongo-dev\n',
    );
  });
});
