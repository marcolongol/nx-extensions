/**
 * This script starts a local registry for e2e testing purposes. It is meant to
 * be called in jest's globalSetup.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';

import stopLocalRegistry from './stop-local-registry';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@nx-extensions/source:local-registry';
  // storage folder for the local registry
  const storage = join(workspaceRoot, 'tmp', 'local-registry', 'storage');

  global.stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: true,
  });

  // releaseVersion rewrites the project manifests to 0.0.0-e2e; keep the
  // originals so the global teardown can put them back.
  global.originalManifests = Object.fromEntries(
    ['libs', 'packages']
      .flatMap((dir) =>
        readdirSync(join(workspaceRoot, dir)).map((project) =>
          join(workspaceRoot, dir, project, 'package.json'),
        ),
      )
      .filter((manifest) => existsSync(manifest))
      .map((manifest) => [manifest, readFileSync(manifest, 'utf8')]),
  );

  try {
    await releaseVersion({
      specifier: '0.0.0-e2e',
      stageChanges: false,
      gitCommit: false,
      gitTag: false,
      firstRelease: true,
      versionActionsOptionsOverrides: {
        skipLockFileUpdate: true,
      },
    });

    // Build the published projects with the e2e version, from the workspace
    // root like CI does, so the published layout matches a real release
    execFileSync('npx', ['nx', 'run-many', '-t', 'build', '-p', 'helm,core'], {
      cwd: workspaceRoot,
      stdio: 'inherit',
    });

    await releasePublish({
      tag: 'e2e',
    });
  } catch (error) {
    // Jest skips globalTeardown when globalSetup fails, so undo the manifest
    // changes and stop the registry (which removes its npm auth token) here
    stopLocalRegistry();
    throw error;
  }
};
