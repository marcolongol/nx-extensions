import {
  formatFiles,
  logger,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';

import { InitGeneratorSchema } from './schema.d';
import {
  registerHelmPlugin,
  updateHelmPluginOptions,
} from '../../utils/workspace';

export const VERSION_ACTIONS =
  '@nx-extensions/helm/src/release/version-actions';

/**
 * Sets up the plugin in a workspace: registers it in nx.json, so every
 * Chart.yaml becomes a chart project, and with `release` adds a `charts`
 * release group that versions those charts. Run by `nx add`.
 */
export async function initGenerator(tree: Tree, options: InitGeneratorSchema) {
  const pluginOptions = {
    ...(options.remote ? { remote: options.remote } : {}),
    ...(options.plainHttp ? { plainHttp: true } : {}),
    ...(options.appVersion ? { appVersion: options.appVersion } : {}),
  };
  // Running init again, e.g. for --release, sets options on the existing
  // registration. The appVersion prompt answers `none` by default, which
  // shouldn't turn off tracking that is already on.
  if (!registerHelmPlugin(tree, pluginOptions)) {
    const { appVersion, ...changes } = pluginOptions;
    const update = {
      ...changes,
      ...(appVersion && appVersion !== 'none' ? { appVersion } : {}),
    };
    if (Object.keys(update).length > 0) {
      updateHelmPluginOptions(tree, update);
    }
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
