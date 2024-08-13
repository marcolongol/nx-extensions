# `@nx-extensions/helm`

First class support for Helm charts in Nx.

The Nx Plugin for Helm provides a set of executors, generators, and utilities to help you manage Helm charts in your Nx workspace.

## Features

- [x] Generate Helm charts for your applications
- [x] Add dependencies to your Helm charts
- [ ] Lint Helm charts
- [ ] Test Helm charts
- [ ] Version Helm charts
- [x] Package Helm charts
- [x] Publish Helm charts

## Getting Started

## Prerequisites

Before you can use the Nx Plugin for Helm, you need to have Helm installed on your machine. You can install Helm by following the instructions [here](https://helm.sh/docs/intro/install/).

### Install the Nx Plugin for Helm

To get started with the Nx Plugin for Helm, run the following command:

```bash
npm install --save-dev @nx-extensions/helm
```

### Add a Helm chart to your project

To get started with the Nx Plugin for Helm, run the following command:

```bash
nx g @nx-extensions/helm:chart --name=my-chart --project=my-app
```

This will generate a new Helm chart for your project under `{projectRoot}/chart` directory and configure the helm target in your project `project.json` file.

```json
{
  "name": "my-app",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    [...]
    "helm": {
      "executor": "@nx-extensions/helm:package",
      "outputs": ["{options.outputFolder}"],
      "options": {
        "chartFolder": "apps/test-project/chart",
        "outputFolder": "{workspaceRoot}/dist/charts/{projectRoot}",
        "push": false,
        "remote": "oci://localhost:5000/helm-charts",
        "dependencies": {
          "update": true,
          "build": true,
          "repositories": []
        }
      }
    }
  }
}
```

### Add a Dependency to your Helm chart

You can also add a dependency to your Helm chart using the `@nx-extensions/helm:dependency` generator:

```bash
nx g @nx-extensions/helm:dependency --project=my-app --chartName=nginx --chartVersion=18.7.1 --repository=https://charts.bitnami.com/bitnami --repositoryName=bitnami
```

This will add the dependency to your Helm chart in the `Chart.yaml` file and add a entry to the `repositories` array in the `project.json` file.

#### Chart.yaml

```yaml
[...]
dependencies:
  - name: nginx
    version: 18.1.7
    repository: 'https://charts.bitnami.com/bitnami'
```

#### project.json

```diff
{
  "name": "my-app",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    [...]
    "helm": {
      "executor": "@nx-extensions/helm:package",
      "outputs": ["{options.outputFolder}"],
      "options": {
        "chartFolder": "apps/test-project/chart",
        "outputFolder": "{workspaceRoot}/dist/charts/{projectRoot}",
        "push": false,
        "remote": "oci://localhost:5000/helm-charts",
        "dependencies": {
          "update": true,
          "build": true,
++        "repositories": [
++          {
++            "name": "bitnami",
++            "url": "https://charts.bitnami.com/bitnami"
++          }
++        ]
        }
      }
    }
  }
}
```

The package executor will automatically run `helm repo add` for each repository defined in the `repositories` array before packaging the chart.

### Build and package your Helm chart

To build and package your Helm chart, you can use the nx run command to execute the `helm` target defined in your project:

```bash
nx run my-app:helm
```

This will build and package your Helm chart and output the packaged chart in the `dist/charts/{projectRoot}` directory under the workspace root.

Optionally, you can tell the executor to update and/or build the chart dependencies by setting the `dependencies.update` and `dependencies.build` option to `true` or `false`. This is going to tell the executor to respectively run `helm dependency update` and/or `helm dependency build` before packaging the chart.

### Publish your Helm chart

By default the executor options will default to `push: false` and `remote: oci://localhost:5000/helm-charts`. To publish your Helm chart to a custom registry, update the `project.json` file with the desired remote and set `push: true`. The chart will be pushed automatically to the defined registry after it gets packaged.

```diff
{
  "name": "my-app",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/my-app/src",
  "projectType": "application",
  "tags": [],
  "targets": {
    [...]
    "helm": {
      "executor": "@nx-extensions/helm:package",
      "outputs": ["{options.outputFolder}"],
      "options": {
        "chartFolder": "apps/test-project/chart",
        "outputFolder": "{workspaceRoot}/dist/charts/{projectRoot}",
--      "push": false,
++      "push": true,
--      "remote": "oci://localhost:5000/helm-charts"
++      "remote": "oci://localhost:5000/my-charts"
        "dependencies": {
          "update": true,
          "build": true
          "repositories": []
        }
      }
    }
  }
}
```
