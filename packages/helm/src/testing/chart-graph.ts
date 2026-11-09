import { joinPathFragments, ProjectGraph, Tree } from '@nx/devkit';
import { parse } from 'yaml';

/**
 * A project graph with a chart project for each chart folder, named like the
 * plugin names them. Specs use it in place of createProjectGraphAsync, since
 * inferred projects aren't in a generator's tree.
 */
export function chartProjectGraph(
  tree: Tree,
  chartRoots: string[],
): ProjectGraph {
  const nodes: ProjectGraph['nodes'] = {};
  for (const root of chartRoots) {
    const { name } = parse(
      tree.read(joinPathFragments(root, 'Chart.yaml'), 'utf8') ?? '',
    ) as { name: string };
    nodes[`${name}-chart`] = {
      name: `${name}-chart`,
      type: 'lib',
      data: { root },
    };
  }
  return { nodes, dependencies: {} };
}
