import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
const { join, dirname } = path;

describe('helm', () => {
  let workspaceDirectory: string;
  let projectDirectory: string;

  beforeAll(() => {
    workspaceDirectory = createTestWorkspace();
    projectDirectory = createTestProject(workspaceDirectory);

    // The plugin has been built and published to a local registry in the jest globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(`npm install @nx-extensions/helm@e2e`, {
      cwd: projectDirectory,
      stdio: 'inherit',
      env: process.env,
    });
  });

  afterAll(() => {
    // Cleanup the test project
    rmSync(workspaceDirectory, {
      recursive: true,
      force: true,
    });
  });

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    execSync('npm ls @nx-extensions/helm', {
      cwd: workspaceDirectory,
      stdio: 'inherit',
    });
  });

  it('should generate a chart', () => {
    execSync(
      `nx generate @nx-extensions/helm:chart my-chart --project=test-project`,
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
    `npx nx generate @nx/node:application ${projectName} --directory=apps --nxCloud=skip --no-interactive`,
    {
      cwd: workspaceDirectory,
      stdio: 'inherit',
      env: process.env,
    },
  );

  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}
