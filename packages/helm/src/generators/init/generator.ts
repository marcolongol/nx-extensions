import {
  formatFiles,
  logger,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';

import { InitGeneratorSchema } from './schema.d';
import { registerHelmPlugin } from '../../utils/workspace';

export const VERSION_ACTIONS =
  '@nx-extensions/helm/src/release/version-actions';

/**
 * Sets up the plugin in a workspace: registers it in nx.json, so every
 * Chart.yaml becomes a chart project, and with `release` adds a `charts`
 * release group that versions those charts. Run by `nx add`.
 */
export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const registered = registerHelmPlugin(tree, {
    ...(options.remote ? { remote: options.remote } : {}),
    ...(options.plainHttp ? { plainHttp: true } : {}),
  });
  if (!registered && (options.remote || options.plainHttp)) {
    logger.warn(
      '@nx-extensions/helm is already registered in nx.json; set remote and plainHttp in its options there.',
    );
  }

  if (options.release) {
    addChartsReleaseGroup(tree);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

function addChartsReleaseGroup(tree: Tree) {
  const nxJson = readNxJson(tree) ?? {};
  const release = nxJson.release ?? {};

  if (release.projects && !release.groups) {
    logger.warn(
      `nx.json sets release.projects, which can't be combined with release groups, so no "charts" group was added. To version charts, move your projects into a group and add one with "projects": ["tag:helm-chart"] and "versionActions": "${VERSION_ACTIONS}".`,
    );
    return;
  }
  if (release.groups?.['charts']) {
    logger.info(
      'nx.json already has a "charts" release group; left it as it is.',
    );
    return;
  }

  nxJson.release = {
    ...release,
    groups: {
      ...release.groups,
      charts: {
        projects: ['tag:helm-chart'],
        projectsRelationship: 'independent',
        version: { versionActions: VERSION_ACTIONS },
      },
    },
  };
  updateNxJson(tree, nxJson);
}

export default initGenerator;
