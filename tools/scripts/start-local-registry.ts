/**
 * This script starts a local registry for e2e testing purposes. It is meant to
 * be called in jest's globalSetup.
 */
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

  await releaseVersion({
    specifier: '0.0.0-e2e',
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    firstRelease: true,
    generatorOptionsOverrides: {
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
