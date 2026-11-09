import {
  formatFiles,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { isPathInside } from '@nx-extensions/core';
import { isMap, isSeq, parseDocument } from 'yaml';

import { DependencyGeneratorSchema } from './schema.d';
import { checkRepositoryUrl } from '../../utils/repository';

export async function dependencyGenerator(
  tree: Tree,
  options: DependencyGeneratorSchema,
) {
  // Rejects credentials in the URL and warns about plain HTTP
  checkRepositoryUrl(options.repository);

  const project = readProjectConfiguration(tree, options.project);

  if (!project.targets?.helm) {
    throw new Error(
      `Project ${options.project} does not have a helm target. Please run the chart generator first.`,
    );
  }

  updateProjectConfiguration(
    tree,
    options.project,
    addDependencyToConfig(project, options.repositoryName, options.repository),
  );

  updateChartYaml(
    tree,
    project,
    options.chartName,
    options.chartVersion,
    options.repository,
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default dependencyGenerator;

function addDependencyToConfig(
  project: ProjectConfiguration,
  name: string,
  url: string,
): ProjectConfiguration {
  const helm = project.targets?.['helm'] ?? {};
  // Re-running the generator for the same repository updates its URL
  // instead of adding a duplicate
  const repositories = [
    ...((helm.options?.repositories ?? []) as { name: string }[]).filter(
      (repository) => repository.name !== name,
    ),
    { name, url },
  ];

  return {
    ...project,
    targets: {
      ...project.targets,
      helm: {
        ...helm,
        options: { ...helm.options, repositories },
      },
    },
  };
}

function updateChartYaml(
  tree: Tree,
  project: ProjectConfiguration,
  name: string,
  version: string,
  repository: string,
) {
  const chartFolder: string = project.targets?.helm?.options?.chartFolder;
  if (!chartFolder || !isPathInside(project.root, chartFolder)) {
    throw new Error(
      `The helm target's chartFolder "${chartFolder}" must be inside the project root "${project.root}".`,
    );
  }

  const chartPath = `${chartFolder}/Chart.yaml`;
  if (!tree.exists(chartPath)) {
    throw new Error(`${chartPath} not found`);
  }

  // A YAML document instead of plain objects, so comments and formatting in
  // Chart.yaml survive the edit
  const chart = parseDocument(tree.read(chartPath, 'utf8') ?? '');
  if (chart.errors.length > 0) {
    throw new Error(
      `Failed to parse ${chartPath}: ${chart.errors.map((error) => error.message).join('; ')}`,
    );
  }

  let dependencies = chart.get('dependencies');
  if (!isSeq(dependencies)) {
    dependencies = chart.createNode([]);
    chart.set('dependencies', dependencies);
  }
  if (!isSeq(dependencies)) {
    throw new Error(`${chartPath} has an invalid dependencies block`);
  }

  const existing = dependencies.items.find(
    (item) => isMap(item) && item.get('name') === name,
  );
  if (isMap(existing)) {
    existing.set('version', version);
    existing.set('repository', repository);
  } else {
    dependencies.add(chart.createNode({ name, version, repository }));
  }

  tree.write(chartPath, chart.toString());
}
