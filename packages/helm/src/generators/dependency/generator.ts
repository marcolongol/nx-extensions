import {
  formatFiles,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import yaml from 'js-yaml';

import { DependencyGeneratorSchema } from './schema.d';

export async function dependencyGenerator(
  tree: Tree,
  options: DependencyGeneratorSchema,
) {
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

  if (options.format) {
    await formatFiles(tree);
  }
}

export default dependencyGenerator;

function addDependencyToConfig(
  project: ProjectConfiguration,
  name: string,
  url: string,
): ProjectConfiguration {
  return {
    ...project,
    targets: {
      ...project.targets,
      helm: {
        ...project.targets.helm,
        options: {
          ...project.targets.helm.options,
          dependencies: {
            ...project.targets.helm.options.dependencies,
            repositories: [
              ...project.targets.helm.options.dependencies.repositories,
              { name: name, url: url },
            ],
          },
        },
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
  const chartFolder = project.targets.helm.options.chartFolder;
  const chartPath = `${chartFolder}/Chart.yaml`;

  if (!tree.exists(chartPath)) {
    throw new Error('Chart.yaml not found');
  }

  try {
    const chartContents = yaml.load(
      tree.read(chartPath, 'utf8').toString(),
    ) as {
      dependencies: { name: string; version: string; repository: string }[];
    };

    if (!chartContents.dependencies) {
      chartContents.dependencies = [];
    }

    const existingDependency = chartContents.dependencies.find(
      (dep) => dep.name === name,
    );

    if (existingDependency) {
      existingDependency.version = version;
      existingDependency.repository = repository;
    } else {
      chartContents.dependencies.push({
        name: name,
        version: version,
        repository: repository,
      });

      tree.write(chartPath, yaml.dump(chartContents));
    }
  } catch (error) {
    console.error(error);
    throw new Error('Failed to parse Chart.yaml');
  }
}
