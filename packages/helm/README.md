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

### Prerequisites

The plugin runs the `helm` CLI, so [install Helm](https://helm.sh/docs/intro/install/) first. It supports Nx 22 to 24 and is tested with Helm v4: on every change with the Nx version this repository uses, and weekly with the newest Nx and with Nx 22.

### Install the Nx Plugin for Helm

```bash
npm install --save-dev @nx-extensions/helm
```

On Nx 22, install the matching `@nx/devkit` with it. Otherwise npm picks the newest `@nx/devkit` the plugin accepts, which needs Nx 23 or later:

```bash
npm install --save-dev @nx-extensions/helm @nx/devkit@22
```

### Add a Helm chart to your project

Add a chart and a `helm` target to an existing project:

```bash
nx g @nx-extensions/helm:chart --name=my-chart --project=my-app
```

This generates a Helm chart in `{projectRoot}/chart` and adds a `helm` target to the project configuration (its `project.json`, or the `nx` field of its `package.json`). The chart matches what `helm create` generates in Helm v4, including an optional Gateway API `HTTPRoute`.

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

The package executor runs `helm repo add` for each repository in `repositories` before handling the dependencies.

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

## Chart projects

Instead of adding a `helm` target to an app, the plugin can turn every Helm chart in the workspace into its own Nx project. Register it in `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "@nx-extensions/helm",
      "options": {
        "remote": "oci://ghcr.io/my-org/charts"
      }
    }
  ]
}
```

Every `Chart.yaml` then becomes a project named `<chart name>-chart` and tagged `helm-chart`, for example `apps/my-app/chart` → `my-app-chart`. A chart inside an app's folder is its own project: changing the chart doesn't affect the app, and the other way round. These are skipped:

- vendored subcharts in another chart's `charts/` folder
- anything under `node_modules` or `dist`
- charts that a project already packages with a `helm` target from the chart generator

Each chart project gets two targets:

| Target         | Description                                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `helm-package` | Packages the chart into `dist/charts/<chart folder>`. Cached: it only runs again when the chart, or a chart it depends on, changes. |
| `helm-push`    | Packages the chart and pushes it to `remote`.                                                                                       |

Both use the [package executor](#build-and-package-your-helm-chart), so its options can be set per run, e.g. `nx run my-app-chart:helm-push --chartVersion=1.2.3`.

Plugin options:

| Option              | Default                                     | Description                                                            |
| ------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `projectName`       | `{chartName}-chart`                         | Name of the chart projects; `{chartName}` is the `name` in Chart.yaml. |
| `packageTargetName` | `helm-package`                              | Name of the package target.                                            |
| `pushTargetName`    | `helm-push`                                 | Name of the push target.                                               |
| `outputFolder`      | `{workspaceRoot}/dist/charts/{projectRoot}` | Where packaged charts go.                                              |
| `remote`            |                                             | OCI registry for the push target.                                      |
| `plainHttp`         | `false`                                     | Use plain HTTP for OCI registries without TLS.                         |

### Umbrella charts

A chart that depends on other charts in the workspace, through `file://` paths or `oci://` dependencies with the name of a workspace chart, depends on them in the project graph too. So an umbrella chart that combines a frontend and a backend is rebuilt when either changes:

```yaml
# charts/platform/Chart.yaml
apiVersion: v2
name: platform
version: 1.4.0
dependencies:
  - name: frontend
    version: 2.1.0
    repository: file://../../apps/frontend/chart
  - name: backend
    version: 3.0.2
    repository: file://../../apps/backend/chart
```

`helm-package` on the umbrella builds its `file://` subcharts into its `charts/` folder before packaging, so the packaged umbrella contains them. Add `charts/*/charts/*.tgz` (or wherever your umbrellas live) to `.gitignore`.

## Upgrading from 1.x

2.0.0 renames and flattens the executor options. Run `nx migrate @nx-extensions/helm@latest` and then `nx migrate --run-migrations` to update your `helm` targets and `targetDefaults`:

- `version` is now `chartVersion`, since Nx uses `--version` itself.
- `dependencies.update`, `dependencies.build` and `dependencies.repositories` are now `updateDependencies`, `buildDependencies` and `repositories`.
- New targets default to `buildDependencies: true` and `updateDependencies: false`. The migration writes your 1.x behaviour (`updateDependencies: true`, `buildDependencies: false`) into existing targets, so nothing changes until you decide to.
- New charts name their template helpers after the chart instead of `chart.`. Existing charts are left as they are.
- Repositories now go to a workspace-local Helm repository config. Charts that relied on repositories added to your global Helm config must list them in `repositories`, or set `HELM_REPOSITORY_CONFIG`.
- Repository URLs with credentials in them (`https://user:pass@...`) are rejected. Use the repository's `username` and `passwordEnv` instead.
- The generators' `format` option is deprecated and has no effect: generated files are now always formatted, unless you pass `--skipFormat`.
