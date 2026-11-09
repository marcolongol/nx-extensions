# `@nx-extensions/helm`

Helm charts as first-class Nx projects.

Keep your charts next to the apps they deploy, and let Nx do the chores: package and lint only the charts that changed, version them from your commits with `nx release`, keep each chart's `appVersion` in step with its app, and publish everything to an OCI registry, umbrella charts included.

- **Chart projects:** every `Chart.yaml` becomes an Nx project with cached `helm-package`, `helm-lint` and `helm-template` targets, plus `helm-push`.
- **Generators:** charts matching `helm create`, dependencies, and umbrella charts that bundle your charts.
- **Versioning:** `nx release` bumps `Chart.yaml`, writes changelogs and tags, and bumps umbrellas when their subcharts change.
- **Publishing:** `nx release publish` pushes new chart versions to an OCI registry and skips the ones already there.

## Quick start

You need [Helm](https://helm.sh/docs/intro/install/) v4 on your `PATH` and an Nx workspace on Nx 23 or 24.

**1. Add the plugin**

```bash
nx add @nx-extensions/helm
```

It asks a few questions: the OCI registry to push charts to, whether a chart's `appVersion` should follow its app, and whether to set up `nx release` for your charts. Every answer can be changed later in `nx.json`.

**2. Add a chart to an app**

```bash
nx g @nx-extensions/helm:chart --project=my-app
```

This creates `apps/my-app/chart`, the same chart `helm create` makes, and it becomes the project `my-app-chart`.

**3. Check, package and push it**

```bash
nx run-many -t helm-lint helm-template -p my-app-chart
nx run my-app-chart:helm-package   # into dist/charts/apps/my-app/chart
nx run my-app-chart:helm-push      # and push it to your registry
```

**4. Release it**

```bash
nx release --dry-run   # see what would change
nx release             # bump, changelog, tag and publish
```

## Example: a frontend, a backend and an umbrella

Say your workspace has a `frontend` and a `backend` app, and you want to ship them in one Helm release.

```bash
nx g @nx-extensions/helm:chart --project=frontend
nx g @nx-extensions/helm:chart --project=backend
nx g @nx-extensions/helm:umbrella platform   # pick frontend-chart and backend-chart
```

You now have three chart projects:

```
apps/frontend/chart/   → frontend-chart
apps/backend/chart/    → backend-chart
charts/platform/       → platform-chart, with both charts as file:// subcharts
```

`charts/platform/Chart.yaml` lists the subcharts, each with a `condition` so it can be switched off at install time:

```yaml
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

Nx knows the umbrella depends on both charts, so:

- `nx affected -t helm-package` packages the umbrella again when a subchart changes, with the subcharts inside it.
- A `fix:` commit to `apps/frontend/chart` releases `frontend-chart` as a patch, and `platform-chart` gets a patch too, with its `frontend` entry updated to the new version.
- `nx release publish` pushes the frontend first and then the umbrella, and skips the backend, which is already in the registry at its version.

With `appVersion: "project"`, releasing the `frontend` app itself bumps `frontend-chart` and sets its `appVersion` to the app's new version.

## Chart projects

Every `Chart.yaml` in the workspace becomes a project, tagged `helm-chart`. A chart inside an app's folder is a project of its own: changing the chart doesn't affect the app, and the other way round. Subcharts vendored in another chart's `charts/` folder, and anything in `node_modules` or `dist`, are skipped.

| Target               | What it does                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `helm-package`       | Packages the chart into `dist/charts/<chart folder>`. Cached: it only runs again when the chart, or a chart it bundles, changes. |
| `helm-push`          | Packages the chart and pushes it to your registry.                                                                               |
| `helm-lint`          | Runs `helm lint`. Cached.                                                                                                        |
| `helm-template`      | Renders the chart with `helm template` to check that it renders, without printing the manifests. Cached.                         |
| `nx-release-publish` | Used by `nx release publish`, see [Publishing](#publishing).                                                                     |

All of them build the chart's dependencies first, so an umbrella is always packaged, linted and rendered with its subcharts.

### Naming

A chart project is named `<chart name>-chart`, so `apps/my-app/chart` is `my-app-chart`.

Chart names can't contain dots, because Kubernetes resource names are built from them: the chart of an app called `my.app` is named `my-app`, and its project `my-app-chart`. If you'd rather name chart projects after their app, set the plugin's `projectName` option to `{projectName}-chart`. The chart in `apps/my.app` is then `my.app-chart`, and an umbrella in `charts/platform`, which isn't inside any app, stays `platform-chart`. With that pattern, give each app one chart, or their project names clash.

Renaming chart projects changes their release tags, so settle on a pattern before your first release.

### Configuration

The plugin's options live in its entry in `nx.json`. `nx add` writes them out with their defaults, so you can see what there is to change:

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
        "appVersion": "none",
        "remote": "oci://ghcr.io/my-org/charts"
      }
    }
  ]
}
```

| Option               | Default                                     | Description                                                                                                                                       |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectName`        | `{chartName}-chart`                         | Name of the chart projects. `{chartName}` is the `name` in Chart.yaml; `{projectName}` is the project the chart is in, or the chart name if none. |
| `packageTargetName`  | `helm-package`                              | Name of the package target.                                                                                                                       |
| `pushTargetName`     | `helm-push`                                 | Name of the push target.                                                                                                                          |
| `lintTargetName`     | `helm-lint`                                 | Name of the lint target.                                                                                                                          |
| `templateTargetName` | `helm-template`                             | Name of the template target.                                                                                                                      |
| `outputFolder`       | `{workspaceRoot}/dist/charts/{projectRoot}` | Where packaged charts go.                                                                                                                         |
| `remote`             |                                             | OCI registry that `helm-push` and `nx release publish` push to.                                                                                   |
| `plainHttp`          | `false`                                     | Talk to OCI registries without TLS, see [Local registries](#local-registries-without-tls).                                                        |
| `appVersion`         | `none`                                      | `project`: a chart's `appVersion` follows the project it's in, see [Versioning](#versioning-with-nx-release).                                     |

To change a target for one chart, add a `project.json` next to its `Chart.yaml`. Nx merges it into the inferred project. Keep the `name` in it, or Nx names the project after its folder:

```json
{
  "name": "my-app-chart",
  "targets": {
    "helm-lint": { "options": { "strict": true, "values": ["values-prod.yaml"] } }
  }
}
```

You can also pass options for a single run, e.g. `nx run my-app-chart:helm-push --chartVersion=1.2.3`. All target options are in the [reference](#target-options).

## Generators

### `init`

Registers the plugin in `nx.json`. `nx add` runs it for you. Run it again to change your answers, or pass them as flags:

```bash
nx g @nx-extensions/helm:init --remote=oci://ghcr.io/my-org/charts --appVersion=project --release
```

- `--remote`, `--plainHttp` and `--appVersion` set those plugin options.
- `--release` adds a `charts` release group, see [Versioning](#versioning-with-nx-release).
- `--no-interactive` (and CI) skips the questions and keeps the defaults.

Running `init` again never turns `appVersion: "project"` off; change it in `nx.json` for that.

### `chart`

```bash
nx g @nx-extensions/helm:chart --project=my-app
nx g @nx-extensions/helm:chart api --project=my-app --chartFolder=deploy/api
```

Generates the chart `helm create` makes in Helm v4, including an optional Gateway API `HTTPRoute`, with its template helpers named after the chart (`my-app.fullname`, `my-app.labels`, ...).

- The chart is named after the project, without an npm scope: `@org/my-app` gives `my-app`. Pass a name to pick another.
- Names are made valid for Kubernetes: lowercase letters, digits and `-`, so `my.app` becomes `my-app`.
- `--chartFolder` is relative to the project root and defaults to `chart`.
- The chart's `templates` folder goes into `.prettierignore`, since Prettier can't parse Helm templates, and its downloaded dependencies (`charts/*.tgz`) into `.gitignore`.

### `umbrella`

```bash
nx g @nx-extensions/helm:umbrella platform --charts=frontend-chart,backend-chart
```

Creates an umbrella chart in `charts/<name>` (or `--directory`) with your chart projects as `file://` subcharts at their current versions. Leave out `--charts` to pick them from a list.

- Each subchart gets `condition: <name>.enabled` and `enabled: true` in the umbrella's `values.yaml`, so `helm install --set backend.enabled=false` leaves the backend out.
- `templates/NOTES.txt` tells you which subcharts an install deployed.
- `--publishSubcharts=false` stops `nx release publish` from pushing the subcharts on their own; they still ship inside the umbrella.

### `dependency`

```bash
# A chart from a repository
nx g @nx-extensions/helm:dependency my-app-chart --chartName=nginx --chartVersion=18.1.7 --repository=https://charts.example.com --repositoryName=example
# A chart project from this workspace
nx g @nx-extensions/helm:dependency platform-chart --chartProject=my-app-chart
```

Adds the dependency to the chart's `Chart.yaml`, keeping its comments. Running it again for the same dependency updates its version and repository.

- `--chartProject` adds a workspace chart as a `file://` dependency at its current version.
- `https://` and `http://` repositories need a `--repositoryName`: the generator adds them to the `repositories` option of the chart's targets, in a `project.json` next to its `Chart.yaml`, so they're added with `helm repo add` before dependencies are built.
- `oci://` and `file://` dependencies are used directly and need no repository entry.

## Versioning with nx release

Charts are versioned with [Nx Release](https://nx.dev/features/manage-releases): `nx release` works out each chart's next version from your conventional commits, writes it to `Chart.yaml`, adds a `CHANGELOG.md` next to the chart and tags the release. `nx g @nx-extensions/helm:init --release` adds the release group for this:

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

How versions move:

- **Commits count for the chart they touch.** A commit to `apps/my-app/chart` bumps `my-app-chart`, not `my-app`.
- **0.x charts** get a patch for a `feat` and a minor for a breaking change, like npm packages. `helm create` starts charts at 0.1.0.
- **Umbrellas** get a patch when a subchart is released, and their `dependencies` entry is updated: exact versions are replaced, `^` and `~` ranges keep their prefix, and other ranges such as `>=1.0.0` are left alone. If the umbrella has a `Chart.lock`, it's refreshed with `helm dependency update` in the same release commit.
- **`appVersion: "project"`** links a chart to the project it's in. When that project is released, for example in its own release group, the chart gets a patch and its `appVersion` is set to the project's new version.

Charts and npm packages can be released together: give the packages their own release group with the default version actions.

### Publishing

`nx release publish`, or the publish step of `nx release`, pushes each released chart to the plugin's `remote` at the version in its `Chart.yaml`. Subcharts are pushed before the umbrellas that bundle them.

- **Already published versions are skipped**, so a publish that failed half way can simply be run again.
- **`--dry-run`** packages the charts without pushing them.
- **Log in to your registry** with Helm before publishing, e.g. in CI:

  ```bash
  echo "$REGISTRY_TOKEN" | helm registry login ghcr.io --username my-user --password-stdin
  nx release publish
  ```

- **Releasing one chart with `--projects`** also bumps the umbrellas that bundle it, but Nx only publishes the projects you named. Run `nx release publish` afterwards to push the umbrellas too.
- **Keep a subchart from being pushed on its own** with `publish: false`, which the umbrella generator's `--publishSubcharts=false` sets for you:

  ```json
  {
    "name": "frontend-chart",
    "targets": {
      "nx-release-publish": { "options": { "publish": false } }
    }
  }
  ```

## Recipes

### Local registries without TLS

Helm v4 only uses plain HTTP when told to, even for `localhost`. For a registry without TLS, such as a local `registry:3` container, set the plugin's `plainHttp: true`: pushes and OCI dependency downloads then use `--plain-http`. If an umbrella's OCI dependencies come from such a registry, also set `"versionActionsOptions": { "plainHttp": true }` under `release.version`, so the `Chart.lock` refresh during a release uses it too.

### Private chart repositories

Never put credentials in a repository URL; URLs like `https://user:pass@charts.example.com` are rejected. Give the repository a `username` and the name of an environment variable that holds the password:

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

The password goes to `helm repo add --password-stdin`, so it never shows up in `project.json`, the command line or the logs.

Repositories are added to a Helm repository config inside the workspace (`node_modules/.cache/@nx-extensions/helm`), not your global one, so list every repository a chart needs, or set `HELM_REPOSITORY_CONFIG` to use your own config. Plain `http://` repositories work, with a warning, since their charts could be tampered with on the way.

### See what the checks found

Nx hides the output of tasks that succeed. To see `helm lint`'s findings, run with `--output-style=static`:

```bash
nx run-many -t helm-lint --output-style=static
```

## Reference

### Target options

`helm-package` and `helm-push`:

| Option               | Default | Description                                                                                                            |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `chartFolder`        |         | Folder of the chart, relative to the workspace root.                                                                   |
| `outputFolder`       |         | Folder for the packaged chart, relative to the workspace root or absolute.                                             |
| `chartVersion`       |         | Overrides the chart version (`helm package --version`).                                                                |
| `appVersion`         |         | Overrides the app version (`helm package --app-version`).                                                              |
| `buildDependencies`  | `true`  | Runs `helm dependency build`, which downloads the versions pinned in `Chart.lock` (or resolves them).                  |
| `updateDependencies` | `false` | Runs `helm dependency update`, which resolves the dependencies again and rewrites `Chart.lock`.                        |
| `repositories`       | `[]`    | Chart repositories to add before handling dependencies, see [Private chart repositories](#private-chart-repositories). |
| `push`               | `false` | Pushes the packaged chart to `remote`. Set on `helm-push`.                                                             |
| `remote`             |         | OCI registry to push to, e.g. `oci://ghcr.io/my-org/charts`.                                                           |
| `plainHttp`          | `false` | Uses plain HTTP for OCI registries without TLS.                                                                        |

`helm-lint` and `helm-template`:

| Option              | Default | Description                                                                       |
| ------------------- | ------- | --------------------------------------------------------------------------------- |
| `values`            | `[]`    | Values files to use, relative to the chart folder, e.g. `["values-prod.yaml"]`.   |
| `strict`            | `false` | `helm-lint` only: fail on warnings too (`helm lint --strict`).                    |
| `buildDependencies` | `true`  | Builds the dependencies first. Turn it off for charts with vendored dependencies. |
| `repositories`      | `[]`    | Chart repositories to add before building dependencies.                           |
| `plainHttp`         | `false` | Uses plain HTTP for OCI dependencies from registries without TLS.                 |

`nx-release-publish` takes `chartFolder`, `outputFolder`, `remote`, `plainHttp`, `repositories`, and `publish` (default `true`).

### Supported versions

The plugin supports the current and the previous Nx major, today Nx 24 and 23, and Helm v4. It's tested on every change with the Nx version this repository uses, and weekly with the newest Nx and the previous major.

When a new Nx major comes out, a plugin release adds it and drops the oldest one. Any change to how the plugin is configured comes with a migration, so `nx migrate` keeps your workspace up to date:

```bash
nx migrate @nx-extensions/helm@latest
nx migrate --run-migrations
```

On the previous Nx major, install the matching `@nx/devkit` with the plugin, since npm would otherwise pick the newest one, which needs the newest Nx:

```bash
npm install --save-dev @nx/devkit@23
```

## Upgrading from 1.x

2.0.0 needs Nx 23 or later, so update Nx first. Then run:

```bash
nx migrate @nx-extensions/helm@latest
nx migrate --run-migrations
```

Every chart is a [chart project](#chart-projects) in 2.0.0, and the migrations take care of the move:

- **The plugin is registered** in `nx.json`.
- **`helm` targets become chart projects:** `nx run my-app:helm` is now `nx run my-app-chart:helm-package`, or `helm-push` for a target that pushed. Options that differ from the defaults, such as `repositories`, move to a `project.json` next to the chart, and a `remote` that all targets shared moves to the plugin options.
- **Options are renamed:** `version` is now `chartVersion`, since Nx uses `--version` itself, and `dependencies.update`, `dependencies.build` and `dependencies.repositories` are now `updateDependencies`, `buildDependencies` and `repositories`, in `targetDefaults` too.
- **Your dependency behaviour is kept:** new charts default to `buildDependencies: true` and `updateDependencies: false`, but migrated charts keep 1.x's `updateDependencies: true` and `buildDependencies: false` until you change them.

The migrations leave a few things for you, with a warning: `helm` targets that have `configurations`, and other targets whose `dependsOn` points at a removed `helm` target.

Other changes in 2.0.0:

- Packaged charts go to `dist/charts/<chart folder>` instead of `dist/charts/<app folder>`, unless you set your own `outputFolder`.
- New charts name their template helpers after the chart instead of `chart.`; existing charts are left as they are.
- Repositories are added to a workspace-local Helm repository config. Charts that relied on your global Helm config must list their repositories in `repositories`, or set `HELM_REPOSITORY_CONFIG`.
- Repository URLs with credentials in them are rejected; use `username` and `passwordEnv`.
- The generators' `format` option does nothing anymore: generated files are always formatted, unless you pass `--skipFormat`.
