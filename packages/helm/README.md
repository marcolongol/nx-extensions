# `@nx-extensions/helm`

First class support for Helm charts in Nx.

The Nx Plugin for Helm provides a set of executors, generators, and utilities to help you manage Helm charts in your Nx workspace.

## Features

- [x] Generate Helm charts for your applications
- [x] Add dependencies to your Helm charts
- [x] Bundle charts in umbrella charts
- [x] Lint Helm charts
- [x] Check that Helm charts render
- [x] Version Helm charts with `nx release`
- [x] Package Helm charts
- [x] Publish Helm charts

## Getting Started

### Prerequisites

The plugin runs the `helm` CLI, so [install Helm](https://helm.sh/docs/intro/install/) first. It supports Nx 22 to 24 and is tested with Helm v4: on every change with the Nx version this repository uses, and weekly with the newest Nx and with Nx 22.

### Install the Nx Plugin for Helm

```bash
nx add @nx-extensions/helm
```

This installs the plugin and registers it in `nx.json`, so every `Chart.yaml` in the workspace becomes a [chart project](#chart-projects). On Nx 22, install the matching `@nx/devkit` too, since npm otherwise picks the newest `@nx/devkit` the plugin accepts, which needs Nx 23 or later:

```bash
npm install --save-dev @nx/devkit@22
```

The plugin is registered with its default options written out, so `nx.json` shows what you can change (see [Chart projects](#chart-projects)):

```json
{
  "plugins": [
    {
      "plugin": "@nx-extensions/helm",
      "options": {
        "projectName": "{chartName}-chart",
        "packageTargetName": "helm-package",
        "pushTargetName": "helm-push",
        "lintTargetName": "helm-lint",
        "templateTargetName": "helm-template",
        "outputFolder": "{workspaceRoot}/dist/charts/{projectRoot}",
        "appVersion": "none"
      }
    }
  ]
}
```

`nx add` runs the init generator, which asks for the OCI registry to push charts to, whether a chart's `appVersion` should follow the app it's in, and whether to add a release group for `nx release`. Run it again to change them, or pass them as flags:

```bash
nx g @nx-extensions/helm:init --remote=oci://ghcr.io/my-org/charts --appVersion=project --release
```

`--remote`, `--plainHttp` and `--appVersion` set those plugin options; `--release` adds a `charts` release group, see [Versioning charts](#versioning-charts-with-nx-release). With `--no-interactive` (and in CI) nothing is asked and the defaults are used. Running init again doesn't turn off `appVersion: "project"`; set it back to `none` in `nx.json` for that.

### Add a Helm chart to your project

```bash
nx g @nx-extensions/helm:chart --project=my-app
```

This generates a Helm chart in `{projectRoot}/chart`, which becomes the chart project `my-app-chart`. The chart is named after the project (without an npm scope, so `@org/my-app` gives `my-app`); pass a name to pick another, e.g. `nx g @nx-extensions/helm:chart api --project=my-app`. The chart matches what `helm create` generates in Helm v4, including an optional Gateway API `HTTPRoute`, with its template helpers named after the chart (`my-app.fullname`, `my-app.labels`, ...).

- `--chartFolder` is relative to the project root, so `--chartFolder=deploy/chart` creates `{projectRoot}/deploy/chart`.
- The chart name is converted to a valid Kubernetes name: lowercase letters, digits and `-`. For example `my.app` creates a chart named `my-app`.
- The chart's `templates` folder is added to `.prettierignore`, because Prettier cannot parse Helm templates, and its packaged dependencies (`charts/*.tgz`) to `.gitignore`. Other generated files are formatted; pass `--skipFormat` to skip that.

### Package and push your chart

```bash
nx run my-app-chart:helm-package
nx run my-app-chart:helm-push
```

`helm-package` packages the chart into `dist/charts/apps/my-app/chart`. `helm-push` packages it and pushes it to the plugin's `remote`.

## Chart projects

Every `Chart.yaml` becomes a project named `<chart name>-chart` and tagged `helm-chart`, for example `apps/my-app/chart` → `my-app-chart`. A chart inside an app's folder is its own project: changing the chart doesn't affect the app, and the other way round. Vendored subcharts in another chart's `charts/` folder, and anything under `node_modules` or `dist`, are skipped.

| Target               | Description                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `helm-package`       | Packages the chart into `dist/charts/<chart folder>`. Cached: it only runs again when the chart, or a chart it depends on, changes.       |
| `helm-push`          | Packages the chart and pushes it to `remote`.                                                                                             |
| `helm-lint`          | Lints the chart with `helm lint`. Cached.                                                                                                 |
| `helm-template`      | Renders the chart with `helm template`, to check that its templates render. Cached; the manifests are not printed.                        |
| `nx-release-publish` | Used by `nx release publish`: pushes the chart to `remote` at the version in its Chart.yaml. See [Publishing charts](#publishing-charts). |

Plugin options, in the plugin's entry in `nx.json`:

| Option               | Default                                     | Description                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projectName`        | `{chartName}-chart`                         | Name of the chart projects; `{chartName}` is the `name` in Chart.yaml.                                                                                                                                       |
| `packageTargetName`  | `helm-package`                              | Name of the package target.                                                                                                                                                                                  |
| `pushTargetName`     | `helm-push`                                 | Name of the push target.                                                                                                                                                                                     |
| `lintTargetName`     | `helm-lint`                                 | Name of the lint target.                                                                                                                                                                                     |
| `templateTargetName` | `helm-template`                             | Name of the template target.                                                                                                                                                                                 |
| `outputFolder`       | `{workspaceRoot}/dist/charts/{projectRoot}` | Where packaged charts go.                                                                                                                                                                                    |
| `remote`             |                                             | OCI registry for the push target.                                                                                                                                                                            |
| `plainHttp`          | `false`                                     | Use plain HTTP for OCI registries without TLS.                                                                                                                                                               |
| `appVersion`         | `none`                                      | `project`: a chart inside another project's folder depends on that project, so releasing the project bumps the chart and sets its `appVersion`. See [Versioning charts](#versioning-charts-with-nx-release). |

### Target options

`helm-package` and `helm-push` run the package executor:

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

Pass them for a single run, e.g. `nx run my-app-chart:helm-push --chartVersion=1.2.3`, or set them for one chart in a `project.json` next to its `Chart.yaml`. Nx merges it into the inferred project; keep the `name`, or Nx names the project after its folder:

```json
{
  "name": "my-app-chart",
  "targets": {
    "helm-package": { "options": { "updateDependencies": true } }
  }
}
```

### Lint and render checks

```bash
nx run-many -t helm-lint helm-template
```

Both build the chart's dependencies first (`helm dependency build`), so an umbrella chart is checked with its subcharts. Their options:

| Option              | Default | Description                                                                              |
| ------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `values`            | `[]`    | Values files to use, relative to the chart folder, e.g. `["values-prod.yaml"]`.          |
| `strict`            | `false` | `helm-lint` only: fail on warnings too (`helm lint --strict`).                           |
| `buildDependencies` | `true`  | Build the dependencies first. Turn it off for charts whose dependencies are vendored.    |
| `repositories`      | `[]`    | Chart repositories to add before building dependencies, as for the package executor.     |
| `plainHttp`         | `false` | Plain HTTP for OCI dependencies from registries without TLS; set from the plugin option. |

### Registries without TLS

Helm v4 only uses plain HTTP when asked to, even for `localhost`. To use an OCI registry without TLS, such as a local `registry:3` container, set the plugin's `plainHttp: true`. The executor then passes `--plain-http` to `helm push`, and to `helm dependency update` and `helm dependency build` for OCI dependencies.

### Add a dependency to a chart

```bash
# A chart from a repository
nx g @nx-extensions/helm:dependency my-app-chart --chartName=nginx --chartVersion=18.1.7 --repository=https://charts.example.com --repositoryName=example
# A chart project in this workspace
nx g @nx-extensions/helm:dependency platform-chart --chartProject=my-app-chart
```

This adds the dependency to the chart's `Chart.yaml`, keeping its comments. Running it again for the same chart updates its version and repository. `--chartProject` adds a workspace chart as a `file://` dependency at its current version.

`https://` and `http://` repositories are added with `helm repo add` before the dependencies are built, so the generator writes them to the `repositories` option of the chart's targets, in a `project.json` next to its `Chart.yaml`. `oci://` and `file://` dependencies are used directly and don't need one.

- Repositories are added to a Helm repository config inside the workspace (`node_modules/.cache/@nx-extensions/helm`), not to your global one. Declare every repository your chart needs in `repositories`, or set `HELM_REPOSITORY_CONFIG` to use your own config.
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

### Umbrella charts

An umbrella chart bundles charts of the workspace, so one `helm install` deploys them together:

```bash
nx g @nx-extensions/helm:umbrella platform --charts=frontend-chart,backend-chart
```

Leave out `--charts` to pick them from a list of the workspace's chart projects. This creates `charts/platform` (pick another folder with `--directory`) with the charts as `file://` subcharts at their current versions, and a `values.yaml` section for each. Every subchart has a `condition`, so it can be left out of an install with `--set frontend.enabled=false`:

```yaml
# charts/platform/Chart.yaml
apiVersion: v2
name: platform
description: Deploys frontend, backend together
type: application
version: 0.1.0
dependencies:
  - name: frontend
    version: 0.1.0
    repository: file://../../apps/frontend/chart
    condition: frontend.enabled
  - name: backend
    version: 0.1.0
    repository: file://../../apps/backend/chart
    condition: backend.enabled
```

A chart that depends on other workspace charts, through `file://` paths or `oci://` dependencies with the name of a workspace chart, depends on them in the project graph too, so `platform-chart:helm-package` runs again when a subchart changes, and packages the subcharts into the umbrella. With `--publishSubcharts=false`, `nx release publish` only pushes the umbrella, see [Publishing charts](#publishing-charts).

## Versioning charts with nx release

Chart projects can be versioned with [Nx Release](https://nx.dev/features/manage-releases): `nx release` bumps `version` in each chart's `Chart.yaml` from your conventional commits, writes a `CHANGELOG.md` next to the chart and tags it. `nx g @nx-extensions/helm:init --release` adds a release group for the charts that uses the plugin's version actions:

```json
{
  "release": {
    "projectsRelationship": "independent",
    "version": { "conventionalCommits": true },
    "changelog": { "projectChangelogs": true },
    "groups": {
      "charts": {
        "projects": ["tag:helm-chart"],
        "version": {
          "versionActions": "@nx-extensions/helm/src/release/version-actions"
        }
      }
    }
  }
}
```

- **Commits count for the chart they touch.** A commit to `apps/my-app/chart` bumps `my-app-chart`, not the app.
- **0.x versions.** Like npm packages, a chart below 1.0.0 gets a patch bump for a `feat`, and a minor bump for a breaking change. `helm create` starts charts at 0.1.0.
- **Umbrella charts.** When a chart that an umbrella depends on is released, the umbrella gets a patch bump and its `dependencies` entry is updated to the new version. Exact versions are replaced; `^` and `~` ranges keep their prefix; other ranges (`>=1.0.0`, `1.x`) are left as they are. The umbrella's `Chart.lock` is refreshed with `helm dependency update` in the same release commit, so `helm` has to be on the `PATH` when you release.
- **`appVersion`.** With the plugin's `appVersion: "project"` option (`init --appVersion=project`), a chart inside an app's folder depends on the app. When the app is released too (e.g. in its own release group), the chart gets a patch bump and its `appVersion` is set to the app's new version.
- **Registries without TLS.** If an umbrella's OCI dependencies come from a registry without TLS, set `"versionActionsOptions": { "plainHttp": true }` under `release.version`, so the `Chart.lock` refresh uses `--plain-http`.

Charts and npm packages can be released together: give the packages their own release group with the default version actions.

### Publishing charts

`nx release publish` (or the publish step of `nx release`) runs each chart's `nx-release-publish` target, which packages the chart at the version in its Chart.yaml and pushes it to the plugin's `remote`. Charts go after the charts they depend on, so subcharts are pushed before their umbrella.

- **Already published versions are skipped**, checked with `helm show chart`, so a publish can be re-run safely.
- **`nx release --projects=<chart>`** versions the umbrellas that bundle the chart too, but Nx only publishes the projects you named. Run `nx release publish` afterwards to push the umbrellas; the charts that are already published are skipped.
- **`--dry-run`** packages the charts without pushing them.
- **Subcharts that only ship inside an umbrella** can skip being pushed on their own. The umbrella generator's `--publishSubcharts=false` adds this `project.json` next to each subchart's Chart.yaml:

  ```json
  {
    "name": "frontend-chart",
    "targets": {
      "nx-release-publish": { "options": { "publish": false } }
    }
  }
  ```

  With `file://` dependencies, the umbrella contains its subcharts either way.

- **Registry credentials** come from Helm's own registry config. Log in before publishing, e.g. in CI:

  ```bash
  echo "$REGISTRY_TOKEN" | helm registry login ghcr.io --username my-user --password-stdin
  npx nx release publish
  ```

## Upgrading from 1.x

Run `nx migrate @nx-extensions/helm@latest` and then `nx migrate --run-migrations`. In 2.0.0 every chart is a [chart project](#chart-projects), so the migrations:

- **Register the plugin** in `nx.json`.
- **Replace the `helm` targets** with the chart projects the plugin infers: `nx run my-app:helm` becomes `nx run my-app-chart:helm-package`, or `helm-push` for a target that pushed. Options that differ from what the plugin infers, such as `repositories`, go to a `project.json` next to the chart's `Chart.yaml`. A `remote` that every target shared goes to the plugin options. Targets with `configurations` are left alone, with a warning, for you to move by hand; so are other targets' `dependsOn` on the removed `helm` target.
- **Rename the executor options:** `version` is now `chartVersion`, since Nx uses `--version` itself, and `dependencies.update`, `dependencies.build` and `dependencies.repositories` are now `updateDependencies`, `buildDependencies` and `repositories`, also in `targetDefaults`.
- **Keep your 1.x dependency behaviour:** new charts default to `buildDependencies: true` and `updateDependencies: false`, but migrated charts keep `updateDependencies: true` and `buildDependencies: false` until you change them.

Also new in 2.0.0:

- Packaged charts go to `dist/charts/<chart folder>` instead of `dist/charts/<app folder>`, unless you had set another `outputFolder`.
- New charts name their template helpers after the chart instead of `chart.`. Existing charts are left as they are.
- Repositories now go to a workspace-local Helm repository config. Charts that relied on repositories added to your global Helm config must list them in `repositories`, or set `HELM_REPOSITORY_CONFIG`.
- Repository URLs with credentials in them (`https://user:pass@...`) are rejected. Use the repository's `username` and `passwordEnv` instead.
- The generators' `format` option is deprecated and has no effect: generated files are now always formatted, unless you pass `--skipFormat`.
