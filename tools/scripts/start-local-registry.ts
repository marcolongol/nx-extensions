/**
 * This script starts a local registry for e2e testing purposes. It is meant to
 * be called in jest's globalSetup.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { workspaceRoot } from '@nx/devkit';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import { getExecOutput } from '@actions/exec';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@nx-extensions/source:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

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

  // Build all the projects with the new e2e version
  const { stdout: buildOutput } = await getExecOutput('nx', [
    'run-many',
    '--target=build',
    '--all',
  ]);

  console.log(buildOutput);

  await releasePublish({
    tag: 'e2e',
  });
};
