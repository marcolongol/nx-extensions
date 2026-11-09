import {
  Tree,
  addProjectConfiguration,
  formatFiles,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { chartGenerator, toChartName } from './generator';
import { ChartGeneratorSchema } from './schema.d';

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

  it('should throw an error if the project already has a helm target', async () => {
    await expect(chartGenerator(tree, options)).rejects.toThrow(
      `Project ${options.project} already has a helm target. Please remove it before running this command.`,
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
    expect(
      readProjectConfiguration(tree, customOptions.project).targets?.['helm']
        ?.options.chartFolder,
    ).toBe('apps/test-project-custom-folder/custom-folder');
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

  it('should update the project configuration', async () => {
    const helm = readProjectConfiguration(tree, options.project).targets?.[
      'helm'
    ];
    expect(helm).toBeDefined();
    expect(helm?.executor).toBe('@nx-extensions/helm:package');
    expect(helm?.outputs).toEqual(['{options.outputFolder}']);
    expect(helm?.options).toEqual({
      chartFolder: `apps/${options.project}/${options.chartFolder}`,
      outputFolder: '{workspaceRoot}/dist/charts/{projectRoot}',
      push: false,
      updateDependencies: false,
      buildDependencies: true,
      repositories: [],
    });
  });
});

describe('chart generator formatting', () => {
  let tree: Tree;

  beforeEach(() => {
    formatFilesSpy.mockClear();
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-app', { root: 'apps/my-app' });
  });

  // Prettier 3 cannot be imported inside jest's CommonJS VM, so these check
  // that the generator formats, not the formatter output (covered by e2e).
  it('should format the generated files', async () => {
    await chartGenerator(tree, { name: 'my-app', project: 'my-app' });

    expect(formatFilesSpy).toHaveBeenCalledWith(tree);
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
