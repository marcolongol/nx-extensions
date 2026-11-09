import type { Tree } from '@nx/devkit';

/**
 * Appends entries to the workspace `.prettierignore`, creating it if needed.
 * Entries already present are skipped and existing content is left untouched.
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
