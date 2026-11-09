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

Before you can use the Nx Plugin for Helm, you need to have Helm installed on your machine. You can install Helm by following the instructions [here](https://helm.sh/docs/intro/install/). The plugin is tested with Helm v4 and Nx 24, and accepts Nx 22 to 24 as a peer dependency.

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

This will generate a new Helm chart for your project under the `{projectRoot}/chart` directory and configure the helm target in your project `project.json` file. The chart matches what `helm create` generates in Helm v4, including an optional Gateway API `HTTPRoute`.

- `--chartFolder` is relative to the project root, so `--chartFolder=deploy/chart` creates `{projectRoot}/deploy/chart`.
- The chart name is converted to a valid Kubernetes name: lowercase letters, digits and `-`. For example `--name=my.app` creates a chart named `my-app`.
- The chart's `templates` folder is added to `.prettierignore`, because Prettier cannot parse Helm templates. Other generated files are formatted; pass `--skipFormat` to skip that.

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
        "chartFolder": "apps/my-app/chart",
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
        "chartFolder": "apps/my-app/chart",
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

- Repositories are added to a Helm repository config inside the workspace (`node_modules/.cache/@nx-extensions/helm`), not to your global one. Declare every repository your chart needs in `repositories`, or set `HELM_REPOSITORY_CONFIG` to use your own config.
- `oci://` and `file://` dependencies don't need a repository entry and are not added.
- Plain `http://` repositories work, but print a warning, since their charts could be tampered with on the way.

#### Repositories that need authentication

Don't put credentials in the repository URL; the generator and executor reject URLs like `https://user:pass@charts.example.com`. Set a `username` and the name of an environment variable that holds the password instead. The executor passes the password to `helm repo add --password-stdin`, so it never appears in `project.json`, the command line or the logs.

```json
"repositories": [
  {
    "name": "private",
    "url": "https://charts.example.com",
    "username": "ci",
    "passwordEnv": "CHARTS_PASSWORD"
  }
]
```

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
        "chartFolder": "apps/my-app/chart",
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

#### Registries without TLS

Helm v4 only uses plain HTTP when asked to, even for `localhost`. To use an OCI registry without TLS, such as a local `registry:3` container, set `plainHttp: true`. The executor then passes `--plain-http` to `helm push`, and to `helm dependency update` and `helm dependency build` for OCI dependencies.

```diff
      "options": {
        "push": true,
        "remote": "oci://localhost:5000/my-charts",
++      "plainHttp": true,
        [...]
      }
```

You can also pass it for a single run:

```bash
nx run my-app:helm --push --plainHttp
```
