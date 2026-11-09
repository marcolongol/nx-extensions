import { Tree } from '@nx/devkit';

import { PrettierConfig } from './types';

/**
 * Resolves the existing Prettier configuration.
 *
 * @returns {Promise<ExistingPrettierConfig | undefined>}
 */
export async function resolveUserExistingPrettierConfig(): Promise<
  PrettierConfig | undefined
> {
  let prettier: typeof import('prettier');
  try {
    prettier = require('prettier');
  } catch {
    return undefined;
  }

  if (!prettier) {
    return undefined;
  }
  try {
    const filepath = await prettier.resolveConfigFile();
    if (!filepath) {
      return undefined;
    }

    const config = await prettier.resolveConfig(process.cwd(), {
      useCache: false,
      config: filepath,
    });
    if (!config) {
      return undefined;
    }

    return {
      sourceFilepath: filepath,
      config: config,
    };
  } catch {
    return undefined;
  }
}

/**
 * Appends entries to the workspace `.prettierignore`, creating it if needed.
 * Entries already present are skipped and existing content is left untouched.
 *
 * @param {Tree} tree
 * @param {string[]} ignore
 */
export function addToPrettierIgnore(tree: Tree, ignore: string[]) {
  const ignorePath = '.prettierignore';
  const content = tree.exists(ignorePath)
    ? tree.read(ignorePath, 'utf8') || ''
    : '';

  const existing = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = [...new Set(ignore)].filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    return;
  }

  const prefix = content.length === 0 || content.endsWith('\n') ? '' : '\n';
  tree.write(ignorePath, `${content}${prefix}${missing.join('\n')}\n`);
}
