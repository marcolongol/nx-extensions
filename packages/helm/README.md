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
  "targets": {
    "helm": {
      "executor": "@nx-extensions/helm:package",
      "outputs": ["{options.outputFolder}"],
      "options": {
        "chartFolder": "apps/my-app/chart",
        "outputFolder": "{workspaceRoot}/dist/charts/{projectRoot}",
        "push": false,
        "updateDependencies": false,
        "buildDependencies": true,
        "repositories": []
      }
    }
  }
}
```

The generated chart matches `helm create <name>`: its template helpers are named after the chart (`my-chart.fullname`, `my-chart.labels`, ...), so it can be used as a subchart of another generated chart.

### Add a Dependency to your Helm chart

You can also add a dependency to your Helm chart using the `@nx-extensions/helm:dependency` generator:

```bash
nx g @nx-extensions/helm:dependency --project=my-app --chartName=nginx --chartVersion=18.1.7 --repository=https://charts.example.com --repositoryName=example
```

This adds the dependency to the chart's `Chart.yaml`, keeping its comments, and adds the repository to the `repositories` option of the helm target. Running it again for the same chart updates its version and repository.

#### Chart.yaml

```yaml
[...]
dependencies:
  - name: nginx
    version: 18.1.7
    repository: https://charts.example.com
```

#### project.json

```diff
      "options": {
        [...]
--      "repositories": []
++      "repositories": [
++        {
++          "name": "example",
++          "url": "https://charts.example.com"
++        }
++      ]
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

To build and package your Helm chart, run the `helm` target of your project:

```bash
nx run my-app:helm
```

This packages the chart into `dist/charts/{projectRoot}` under the workspace root.

| Option               | Default | Description                                                                                                     |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `chartFolder`        |         | Folder of the chart, relative to the workspace root.                                                            |
| `outputFolder`       |         | Folder for the packaged chart, relative to the workspace root or absolute.                                      |
| `chartVersion`       |         | Overrides the chart version (`helm package --version`).                                                         |
| `appVersion`         |         | Overrides the app version (`helm package --app-version`).                                                       |
| `buildDependencies`  | `true`  | Runs `helm dependency build`, which downloads the dependencies pinned in `Chart.lock` (or resolves them first). |
| `updateDependencies` | `false` | Runs `helm dependency update`, which re-resolves the dependencies and rewrites `Chart.lock`.                    |
| `repositories`       | `[]`    | Chart repositories to add before handling dependencies.                                                         |
| `push`               | `false` | Pushes the packaged chart to `remote`.                                                                          |
| `remote`             |         | OCI registry to push to, e.g. `oci://ghcr.io/my-org/charts`. Required with `push`.                              |
| `plainHttp`          | `false` | Uses plain HTTP for OCI registries without TLS.                                                                 |

Options can also be passed for a single run, e.g. `nx run my-app:helm --chartVersion=1.2.3 --updateDependencies`.

### Publish your Helm chart

To publish your chart, set `push` and the OCI registry to push to. The chart is pushed after it is packaged.

```diff
      "options": {
        [...]
--      "push": false,
++      "push": true,
++      "remote": "oci://ghcr.io/my-org/charts",
      }
```

#### Registries without TLS

Helm v4 only uses plain HTTP when asked to, even for `localhost`. To use an OCI registry without TLS, such as a local `registry:3` container, set `plainHttp: true`. The executor then passes `--plain-http` to `helm push`, and to `helm dependency update` and `helm dependency build` for OCI dependencies.

```diff
      "options": {
        "push": true,
        "remote": "oci://localhost:5000/charts",
++      "plainHttp": true,
        [...]
      }
```

You can also pass it for a single run:

```bash
nx run my-app:helm --push --plainHttp
```

## Upgrading from 1.x

2.0.0 renames and flattens the executor options. Run `nx migrate @nx-extensions/helm@latest` and then `nx migrate --run-migrations` to update your `helm` targets and `targetDefaults`:

- `version` is now `chartVersion`, since Nx uses `--version` itself.
- `dependencies.update`, `dependencies.build` and `dependencies.repositories` are now `updateDependencies`, `buildDependencies` and `repositories`.
- New targets default to `buildDependencies: true` and `updateDependencies: false`. The migration writes your 1.x behaviour (`updateDependencies: true`, `buildDependencies: false`) into existing targets, so nothing changes until you decide to.
- New charts name their template helpers after the chart instead of `chart.`. Existing charts are left as they are.
- Repositories now go to a workspace-local Helm repository config. Charts that relied on repositories added to your global Helm config must list them in `repositories`, or set `HELM_REPOSITORY_CONFIG`.
