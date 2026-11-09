import {
  formatFiles,
  getProjects,
  readNxJson,
  TargetConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

const EXECUTOR = '@nx-extensions/helm:package';

type Options = Record<string, unknown>;

/**
 * Migrates `@nx-extensions/helm:package` targets to the 2.0.0 options:
 * `version` becomes `chartVersion`, and the `dependencies` object becomes
 * `updateDependencies`, `buildDependencies` and `repositories`.
 *
 * 2.0.0 also changed the defaults (`updateDependencies` off,
 * `buildDependencies` on), so existing targets get the 1.x behaviour written
 * out explicitly.
 */
export default async function update(tree: Tree) {
  for (const [name, project] of getProjects(tree)) {
    let changed = false;
    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor === EXECUTOR) {
        migrateTarget(target, { keepOldDefaults: true });
        changed = true;
      }
    }
    if (changed) {
      updateProjectConfiguration(tree, name, project);
    }
  }

  const nxJson = readNxJson(tree);
  if (nxJson?.targetDefaults) {
    let changed = false;
    for (const [key, value] of Object.entries(nxJson.targetDefaults)) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (key === EXECUTOR || entry.executor === EXECUTOR) {
          migrateTarget(entry as TargetConfiguration, {
            keepOldDefaults: false,
          });
          changed = true;
        }
      }
    }
    if (changed) {
      updateNxJson(tree, nxJson);
    }
  }

  await formatFiles(tree);
}

function migrateTarget(
  target: TargetConfiguration,
  { keepOldDefaults }: { keepOldDefaults: boolean },
) {
  if (target.options || keepOldDefaults) {
    target.options = migrateOptions(target.options ?? {}, keepOldDefaults);
  }
  for (const [name, options] of Object.entries(target.configurations ?? {})) {
    // Configurations only override what they set
    target.configurations![name] = migrateOptions(options, false);
  }
}

function migrateOptions(options: Options, keepOldDefaults: boolean): Options {
  const { version, dependencies, ...rest } = options;
  const result: Options = { ...rest };
  const old = (dependencies ?? {}) as {
    update?: boolean;
    build?: boolean;
    repositories?: unknown[];
  };

  if (version !== undefined && result['chartVersion'] === undefined) {
    result['chartVersion'] = version;
  }
  // 1.x defaults: update on, build off
  if (old.update !== undefined || keepOldDefaults) {
    result['updateDependencies'] = old.update ?? true;
  }
  if (old.build !== undefined || keepOldDefaults) {
    result['buildDependencies'] = old.build ?? false;
  }
  if (old.repositories !== undefined) {
    result['repositories'] = old.repositories;
  }
  return result;
}
