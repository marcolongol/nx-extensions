/**
 * This script stops the local registry for e2e testing purposes. It is meant to
 * be called in jest's globalTeardown.
 */
import { writeFileSync } from 'node:fs';

export default () => {
  if (global.stopLocalRegistry) {
    global.stopLocalRegistry();
  }

  // Undo the 0.0.0-e2e version bump from the global setup
  for (const [manifest, content] of Object.entries<string>(
    global.originalManifests ?? {},
  )) {
    writeFileSync(manifest, content);
  }
};
