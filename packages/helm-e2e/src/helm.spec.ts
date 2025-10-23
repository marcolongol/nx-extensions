import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const { join, dirname } = path;
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('helm', () => {
  let workspaceDirectory: string;
  let projectDirectory: string;
  let registryContainer: StartedTestContainer;

  beforeAll(async () => {
    registryContainer = await new GenericContainer('registry:2.7')
      .withExposedPorts({
        container: 5000,
        host: 5000,
      })
      .start();

    workspaceDirectory = createTestWorkspace();
    projectDirectory = createTestProject(workspaceDirectory);

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(`npm install @nx-extensions/helm@e2e`, {
      cwd: workspaceDirectory,
      stdio: 'inherit',
      env: process.env,
    });
  }, 120_000);

  afterAll(async () => {
    await registryContainer.stop();
    // Cleanup the test project
    rmSync(workspaceDirectory, {
      recursive: true,
      force: true,
    });
  }, 120_000);

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    execSync('npm ls @nx-extensions/helm', {
      cwd: workspaceDirectory,
      stdio: 'inherit',
    });
  });

  it('should generate a chart', () => {
    execSync(
      `nx generate @nx-extensions/helm:chart --name=my-chart --project=test-project --no-interactive`,
      {
        cwd: workspaceDirectory,
        stdio: 'inherit',
      },
    );
  });

  it('should package a chart', () => {
    execSync(`nx run test-project:helm`, {
      cwd: workspaceDirectory,
      stdio: 'inherit',
    });
  });

  it('should package and push a chart', () => {
    execSync(`nx run test-project:helm --push`, {
      cwd: workspaceDirectory,
      stdio: 'inherit',
    });
  });

  it('should add a dependency to a chart', () => {
    execSync(
      `nx generate @nx-extensions/helm:dependency --project=test-project --chartName=nginx --chartVersion=18.1.7 --repository=https://charts.bitnami.com/bitnami --repositoryName=bitnami --no-interactive`,
      {
        cwd: workspaceDirectory,
        stdio: 'inherit',
      },
    );
  });

  it('should package and push a chart with dependencies', () => {
    execSync(`nx run test-project:helm --push`, {
      cwd: workspaceDirectory,
      stdio: 'inherit',
    });
  });
});

/**
 * Creates a test workspace with create-nx-workspace
 *
 * @returns The directory where the test workspace was created
 */
function createTestWorkspace() {
  const workspaceName = 'test-workspace';
  const workspaceDirectory = join(process.cwd(), 'tmp', workspaceName);

  // Ensure workspaceDirectory is empty
  rmSync(workspaceDirectory, {
    recursive: true,
    force: true,
  });

  mkdirSync(dirname(workspaceDirectory), {
    recursive: true,
  });

  // Create a new Nx workspace
  execSync(
    `npx --yes create-nx-workspace@latest ${workspaceName} --preset apps --nxCloud=skip --no-interactive`,
    {
      cwd: dirname(workspaceDirectory),
      stdio: 'inherit',
      env: process.env,
    },
  );

  console.log(`Created test workspace in "${workspaceDirectory}"`);

  return workspaceDirectory;
}

/**
 * Creates a test project in the test workspace
 *
 * @returns The directory where the test project was created
 */
function createTestProject(workspaceDirectory: string) {
  const projectName = 'test-project';
  const projectDirectory = join(workspaceDirectory, 'apps', projectName);

  // Create a new express application
  execSync(`npm install @nx/node`, {
    cwd: workspaceDirectory,
    stdio: 'inherit',
    env: process.env,
  });

  execSync(
    `npx nx generate @nx/node:application ${projectName} --directory=apps/${projectName} --nxCloud=skip --no-interactive`,
    {
      cwd: workspaceDirectory,
      stdio: 'inherit',
      env: process.env,
    },
  );

  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}
