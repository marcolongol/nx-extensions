import * as path from 'node:path';

/** Reads a workspace file, relative to the workspace root, or null if missing. */
export type ReadFile = (file: string) => string | null;

/**
 * The name of the project a chart sits in: the nearest folder above the chart
 * with a project.json or package.json, short of the workspace root, which every
 * chart would otherwise belong to. Like Nx, it takes the name from
 * project.json, then package.json, then the folder name.
 */
export function enclosingProjectName(
  chartRoot: string,
  read: ReadFile,
): string | undefined {
  for (
    let dir = path.posix.dirname(chartRoot);
    dir !== '.' && dir !== '' && dir !== '/';
    dir = path.posix.dirname(dir)
  ) {
    const projectJson = readName(read, `${dir}/project.json`);
    const packageJson = readName(read, `${dir}/package.json`);
    if (projectJson.exists || packageJson.exists) {
      return projectJson.name ?? packageJson.name ?? path.posix.basename(dir);
    }
  }
  return undefined;
}

function readName(read: ReadFile, file: string) {
  const content = read(file);
  if (content === null) {
    return { exists: false };
  }
  try {
    const { name } = JSON.parse(content) as { name?: unknown };
    return { exists: true, name: typeof name === 'string' ? name : undefined };
  } catch {
    return { exists: true };
  }
}

/**
 * Fills in the `projectName` plugin option for a chart: `{chartName}` is its
 * name in Chart.yaml, `{projectName}` the project it sits in, or the chart name
 * for a chart outside any project, such as an umbrella in `charts/`.
 */
export function resolveChartProjectName(
  pattern: string,
  chartName: string,
  chartRoot: string,
  read: ReadFile,
): string {
  return pattern
    .replace(
      '{projectName}',
      pattern.includes('{projectName}')
        ? (enclosingProjectName(chartRoot, read) ?? chartName)
        : '',
    )
    .replace('{chartName}', chartName);
}
