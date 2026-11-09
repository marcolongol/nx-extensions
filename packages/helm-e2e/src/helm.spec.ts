import { ChildProcess, execSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { GenericContainer, StartedTestContainer } from 'testcontainers';

const { join } = path;

// Build the test workspace with the Nx version this repo is on, so results
// don't change whenever a new Nx is published. The scheduled canary sets
// E2E_NX_VERSION to test other Nx versions the plugin supports.
const nxVersionOverride = process.env.E2E_NX_VERSION;
const nxVersion: string =
  nxVersionOverride ?? require('nx/package.json').version;
const prettierVersion: string = require('prettier/package.json').version;
const createNxWorkspaceBin = join(
  path.dirname(require.resolve('create-nx-workspace/package.json')),
  require('create-nx-workspace/package.json').bin['create-nx-workspace'],
);

const keepWorkspace = process.env.E2E_KEEP_WORKSPACE === 'true';

describe('helm', () => {
  let tmpDirectory: string;
  let workspaceDirectory: string;
  let projectDirectory: string;
  // test-project or @org/test-project, depending on the layout create-nx-workspace picks
  let projectName: string;
  /** The project the plugin infers for the generated chart. */
  const chartProject = 'my-chart-chart';
  let registryContainer: StartedTestContainer | undefined;
  let chartRepository: ChildProcess | undefined;
  let remote: string;
  let chartRepositoryUrl: string;

  // The steps build on each other, so stop at the first failure instead of
  // reporting every later step as failed too
  let failedStep: string | undefined;
  const step = (name: string, fn: () => void | Promise<void>) =>
    it(
      name,
      async () => {
        if (failedStep) {
          throw new Error(`Skipped because "${failedStep}" failed`);
        }
        try {
          await fn();
        } catch (error) {
          failedStep = name;
          throw error;
        }
      },
      180_000,
    );

  beforeAll(async () => {
    tmpDirectory = mkdtempSync(join(tmpdir(), 'helm-e2e-'));

    registryContainer = await new GenericContainer('registry:3')
      .withExposedPorts(5000)
      .start();
    remote = `oci://${registryContainer.getHost()}:${registryContainer.getMappedPort(5000)}/helm-charts`;

    let port: number;
    ({ server: chartRepository, port } =
      await startChartRepository(tmpDirectory));
    chartRepositoryUrl = `http://127.0.0.1:${port}`;
    publishDependencyChart(tmpDirectory, chartRepositoryUrl);

    workspaceDirectory = createTestWorkspace(tmpDirectory);
    projectDirectory = createTestProject(workspaceDirectory);
    projectName = findProjectName(workspaceDirectory);

    // Install the plugin the global setup published to the local registry.
    // @nx/devkit is pinned to the workspace's Nx version: npm would otherwise
    // pick the newest one in the plugin's peer range, which needs a newer Nx.
    run(
      `npm install @nx-extensions/helm@e2e @nx/devkit@${nxVersion}`,
      workspaceDirectory,
    );
    // What `nx add` runs after installing
    run(
      'npx nx generate @nx-extensions/helm:init --no-interactive',
      workspaceDirectory,
    );
  }, 300_000);

  afterAll(async () => {
    try {
      chartRepository?.kill();
      await registryContainer?.stop();
    } finally {
      if (keepWorkspace || failedStep) {
        console.log(`Keeping the test workspace in "${tmpDirectory}"`);
      } else if (tmpDirectory) {
        rmSync(tmpDirectory, { recursive: true, force: true });
      }
    }
  }, 120_000);

  step('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    run('npm ls @nx-extensions/helm', workspaceDirectory);
  });

  step('should install the published package layout', () => {
    const packageRoot = join(
      workspaceDirectory,
      'node_modules',
      '@nx-extensions',
      'helm',
    );
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8'),
    );

    expect(existsSync(join(packageRoot, manifest.typings))).toBe(true);
    expect(existsSync(join(packageRoot, 'README.md'))).toBe(true);
  });

  step('should generate a chart', () => {
    run(
      `npx nx generate @nx-extensions/helm:chart --name=my-chart --project=${projectName} --no-interactive`,
      workspaceDirectory,
    );

    // Generated files are formatted with the workspace prettier config (which
    // uses double quotes), while the Helm templates are left alone
    const chart = join(projectDirectory, 'chart');
    expect(readFileSync(join(chart, 'Chart.yaml'), 'utf8')).toContain(
      'appVersion: "1.16.0"',
    );
    expect(
      readFileSync(join(chart, 'templates', 'deployment.yaml'), 'utf8'),
    ).toContain('{{- include "my-chart.labels" . | nindent 4 }}');
    expect(
      readFileSync(join(workspaceDirectory, '.prettierignore'), 'utf8'),
    ).toContain('/apps/test-project/chart/templates');
  });

  step('should package a chart', () => {
    run(`npx nx run ${chartProject}:helm-package`, workspaceDirectory);
  });

  step('should package and push a chart', () => {
    run(
      `npx nx run ${chartProject}:helm-push --plainHttp --remote=${remote}`,
      workspaceDirectory,
    );
  });

  step('should add a dependency to a chart', () => {
    run(
      `npx nx generate @nx-extensions/helm:dependency --project=${chartProject} --chartName=e2e-dependency --chartVersion=0.1.0 --repository=${chartRepositoryUrl} --repositoryName=e2e --no-interactive`,
      workspaceDirectory,
    );
  });

  step('should package and push a chart with dependencies', () => {
    run(
      `npx nx run ${chartProject}:helm-push --plainHttp --remote=${remote}`,
      workspaceDirectory,
    );
  });

  step('should package a chart when run from the project folder', () => {
    run(`npx nx run ${chartProject}:helm-package`, projectDirectory);
  });

  step('should add an umbrella chart', () => {
    for (const name of ['frontend', 'backend']) {
      run(
        `npx nx generate @nx-extensions/helm:chart --name=${name} --project=${projectName} --chartFolder=deploy/${name} --no-interactive`,
        workspaceDirectory,
      );
    }
    run(
      'npx nx generate @nx-extensions/helm:umbrella platform --charts=frontend-chart,backend-chart --no-interactive',
      workspaceDirectory,
    );

    expect(
      readFileSync(
        join(workspaceDirectory, 'charts', 'platform', 'Chart.yaml'),
        'utf8',
      ),
    ).toContain('repository: file://../../apps/test-project/deploy/frontend');

    run('npx nx run platform-chart:helm-package', workspaceDirectory);
  });

  step('should lint and render the charts', () => {
    run(
      'npx nx run-many -t helm-lint helm-template --projects=tag:helm-chart',
      workspaceDirectory,
    );
  });

  step('should catch a chart that does not render', () => {
    const service = join(
      projectDirectory,
      'deploy',
      'backend',
      'templates',
      'service.yaml',
    );
    const original = readFileSync(service, 'utf8');
    writeFileSync(
      service,
      `${original}\n{{ .Values.broken | required "broken is required" }}\n`,
    );
    try {
      expect(() =>
        run('npx nx run backend-chart:helm-template', workspaceDirectory),
      ).toThrow();
    } finally {
      writeFileSync(service, original);
    }
  });

  step('should release and publish the charts', () => {
    // The plugin is already registered, so this only adds the release group
    run(
      'npx nx generate @nx-extensions/helm:init --release --no-interactive',
      workspaceDirectory,
    );
    updateJson(join(workspaceDirectory, 'nx.json'), (nxJson) => {
      const helm = nxJson.plugins.find(
        (entry: { plugin?: string }) => entry.plugin === '@nx-extensions/helm',
      );
      helm.options = { ...helm.options, remote, plainHttp: true };
      nxJson.release.git = { push: false };
      nxJson.release.version = { conventionalCommits: true };
      return nxJson;
    });
    run('git init --quiet --initial-branch=main', workspaceDirectory);
    run('git add --all', workspaceDirectory);
    run('git commit --quiet --message="chore: charts"', workspaceDirectory);

    run(
      'npx nx release --specifier=patch --first-release --yes',
      workspaceDirectory,
    );

    expect(readChart('charts/platform')).toContain('version: 0.1.1');
    expect(git('tag --list')).toContain('platform-chart@0.1.1');
    for (const chart of ['platform', 'frontend', 'backend', 'my-chart']) {
      expect(showChart(chart, '0.1.1')).toContain(`name: ${chart}`);
    }
  });

  step('should republish the umbrella when a subchart changes', () => {
    const values = join(projectDirectory, 'deploy', 'frontend', 'values.yaml');
    writeFileSync(
      values,
      readFileSync(values, 'utf8').replace(
        'replicaCount: 1',
        'replicaCount: 2',
      ),
    );
    run(
      'git commit --quiet --all --message="fix: run two frontends"',
      workspaceDirectory,
    );

    run('npx nx release --yes', workspaceDirectory);

    // Only the frontend changed: it and the umbrella that bundles it get a
    // patch bump, and the umbrella ships the new frontend
    const platform = readChart('charts/platform');
    expect(platform).toContain('version: 0.1.2');
    expect(platform).toMatch(/name: frontend\s+version: 0\.1\.2/);
    expect(pulledSubchart('platform', '0.1.2', 'frontend')).toContain(
      'version: 0.1.2',
    );
    expect(git('tag --list')).not.toContain('backend-chart@0.1.2');
  });

  function readChart(chartRoot: string): string {
    return readFileSync(
      join(workspaceDirectory, chartRoot, 'Chart.yaml'),
      'utf8',
    );
  }

  function git(args: string): string {
    return execSync(`git ${args}`, {
      cwd: workspaceDirectory,
      env: testEnv(),
      encoding: 'utf8',
    });
  }

  /** The Chart.yaml of a chart in the e2e registry. */
  function showChart(name: string, version: string): string {
    return execSync(
      `helm show chart ${remote}/${name} --version ${version} --plain-http`,
      { env: testEnv(), encoding: 'utf8' },
    );
  }

  /** The Chart.yaml of a subchart inside a chart pulled from the registry. */
  function pulledSubchart(name: string, version: string, subchart: string) {
    const directory = mkdtempSync(join(tmpDirectory, 'pull-'));
    run(
      `helm pull ${remote}/${name} --version ${version} --plain-http --untar`,
      directory,
    );
    return readFileSync(
      join(directory, name, 'charts', subchart, 'Chart.yaml'),
      'utf8',
    );
  }

  /**
   * Runs a command with a minimal environment: no CI secrets, Nx Cloud off, and
   * Helm config, cache and data kept inside the test directory so the user's
   * Helm repositories are never touched.
   */
  function run(command: string, cwd: string) {
    execSync(command, { cwd, stdio: 'inherit', env: testEnv() });
  }

  function testEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (
        /^(PATH|HOME|USER|LANG|LC_\w+|TERM|TMPDIR|SHELL|CI)$/.test(key) ||
        // npm_config_registry points npm at the local verdaccio registry
        /^npm_config_/i.test(key)
      ) {
        env[key] = value;
      }
    }

    const helmHome = join(tmpDirectory, 'helm');
    return {
      ...env,
      NX_DAEMON: 'false',
      NX_NO_CLOUD: 'true',
      HELM_CONFIG_HOME: join(helmHome, 'config'),
      HELM_CACHE_HOME: join(helmHome, 'cache'),
      HELM_DATA_HOME: join(helmHome, 'data'),
      // nx release commits and tags; keep the user's git config (and commit
      // signing) out of it
      GIT_CONFIG_GLOBAL: gitConfig(),
      GIT_CONFIG_NOSYSTEM: '1',
    };
  }

  function gitConfig(): string {
    const file = join(tmpDirectory, 'gitconfig');
    if (!existsSync(file)) {
      writeFileSync(file, '[user]\n\tname = e2e\n\temail = e2e@example.com\n');
    }
    return file;
  }

  /**
   * Creates a test workspace with the repo's own create-nx-workspace
   *
   * @returns The directory where the test workspace was created
   */
  function createTestWorkspace(parentDirectory: string) {
    const workspaceName = 'test-workspace';

    // The test workspace stands in for a user's npm workspace. Without
    // --packageManager, create-nx-workspace uses whichever package manager
    // ran the tests (pnpm in this repo), and the npm installs below fail.
    const createNxWorkspace = nxVersionOverride
      ? `npx --yes create-nx-workspace@${nxVersionOverride}`
      : `node ${createNxWorkspaceBin}`;
    run(
      `${createNxWorkspace} ${workspaceName} --preset apps --packageManager=npm --nxCloud=skip --skipGit --no-interactive`,
      parentDirectory,
    );
    const directory = join(parentDirectory, workspaceName);

    // The template workspace has no formatter; use prettier so the e2e run
    // covers the generator's formatting and .prettierignore handling
    run(`npm install --save-dev prettier@${prettierVersion}`, directory);
    writeFileSync(join(directory, '.prettierrc'), '{}\n');

    console.log(`Created test workspace in "${directory}"`);

    return directory;
  }

  /**
   * Creates a test project in the test workspace
   *
   * @returns The directory where the test project was created
   */
  function createTestProject(workspace: string) {
    const directory = join(workspace, 'apps', 'test-project');

    // A Node application for the chart
    run(`npm install @nx/node@${nxVersion}`, workspace);
    run(
      `npx nx generate @nx/node:application test-project --directory=apps/test-project --nxCloud=skip --no-interactive`,
      workspace,
    );

    console.log(`Created test project in "${directory}"`);

    return directory;
  }

  function findProjectName(workspace: string): string {
    const projects: string[] = JSON.parse(
      execSync('npx nx show projects --json', {
        cwd: workspace,
        env: testEnv(),
        encoding: 'utf8',
      }),
    );
    const project = projects.find((name) => name.endsWith('test-project'));
    if (!project) {
      throw new Error(`No test project in ${JSON.stringify(projects)}`);
    }
    return project;
  }

  /**
   * Packages a small chart into a local chart repository for the dependency
   * test.
   */
  function publishDependencyChart(parentDirectory: string, url: string) {
    const source = join(parentDirectory, 'dependency-source');
    mkdirSync(source, { recursive: true });
    run('helm create e2e-dependency', source);
    run(
      `helm package e2e-dependency -d ${join(parentDirectory, 'chart-repository')}`,
      source,
    );
    run(
      `helm repo index . --url ${url}`,
      join(parentDirectory, 'chart-repository'),
    );
  }
});

/**
 * Serves `<directory>/chart-repository` as a classic Helm chart repository. It
 * runs in its own process because the test steps block this one with execSync,
 * which would stop an in-process server from answering.
 */
async function startChartRepository(
  directory: string,
): Promise<{ server: ChildProcess; port: number }> {
  const root = join(directory, 'chart-repository');
  mkdirSync(root, { recursive: true });

  const script = `
    const { createServer } = require('node:http');
    const { existsSync, readFileSync } = require('node:fs');
    const { basename, join } = require('node:path');
    const root = process.argv[1];
    const server = createServer((request, response) => {
      const file = join(root, basename(request.url ?? ''));
      if (!existsSync(file)) return response.writeHead(404).end();
      response.writeHead(200).end(readFileSync(file));
    });
    // A string, so FORCE_COLOR (set by jest) doesn't add color codes
    server.listen(0, '127.0.0.1', () => console.log(String(server.address().port)));
  `;
  const server = spawn(process.execPath, ['-e', script, root], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const port = await new Promise<number>((resolve, reject) => {
    let output = '';
    server.once('error', reject);
    server.once('exit', (code) =>
      reject(new Error(`Chart repository exited (${code}): ${output}`)),
    );
    server.stdout?.on('data', (data) => {
      output += String(data);
      const match = output.match(/^(\d+)$/m);
      if (match) {
        resolve(Number(match[1]));
      }
    });
  });
  return { server, port };
}

function updateJson(file: string, update: (json: any) => unknown) {
  writeFileSync(
    file,
    `${JSON.stringify(update(JSON.parse(readFileSync(file, 'utf8'))), null, 2)}\n`,
  );
}
