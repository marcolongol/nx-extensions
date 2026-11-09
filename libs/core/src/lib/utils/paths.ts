import * as path from 'node:path';

/**
 * Whether `target` is `parent` itself or inside it. Both are resolved against
 * the same base, so they can be relative (e.g. Nx tree paths) or absolute.
 */
export function isPathInside(parent: string, target: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/**
 * Resolves `target` against `root` and throws when the result is outside
 * `root`, e.g. a `../../etc` option value.
 *
 * @param label Name of the option, used in the error message
 */
export function resolvePathInside(
  root: string,
  target: string,
  label: string,
): string {
  const resolved = path.resolve(root, target);
  if (!isPathInside(root, resolved)) {
    throw new Error(`${label} "${target}" must be inside "${root}".`);
  }
  return resolved;
}
