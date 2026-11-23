# 2.0.0 (2026-11-23)

### 🚀 Features

- ⚠️  **helm:** support the current and previous Nx major only ([ab69070](https://github.com/marcolongol/nx-extensions/commit/ab69070))
- **helm:** name chart projects after their app with {projectName} ([a65393f](https://github.com/marcolongol/nx-extensions/commit/a65393f))
- **helm:** lint and render check targets for chart projects ([9824a0d](https://github.com/marcolongol/nx-extensions/commit/9824a0d))
- **helm:** name the chart after its project by default ([9ab86e5](https://github.com/marcolongol/nx-extensions/commit/9ab86e5))
- **helm:** give each umbrella subchart a condition ([d8734bd](https://github.com/marcolongol/nx-extensions/commit/d8734bd))
- **helm:** ask for the registry, appVersion and release group in init ([35662f0](https://github.com/marcolongol/nx-extensions/commit/35662f0))
- **helm:** pick the umbrella's charts from a list ([f3b6565](https://github.com/marcolongol/nx-extensions/commit/f3b6565))
- **helm:** write the plugin defaults to nx.json and add init flags ([d71e154](https://github.com/marcolongol/nx-extensions/commit/d71e154))
- **helm:** generate chart projects and migrate helm targets to them ([c21b11a](https://github.com/marcolongol/nx-extensions/commit/c21b11a))
- **helm:** publish charts with nx release publish ([4ca1a9a](https://github.com/marcolongol/nx-extensions/commit/4ca1a9a))
- **helm:** version charts with nx release ([e0d8ad3](https://github.com/marcolongol/nx-extensions/commit/e0d8ad3))
- **helm:** infer a project for every Helm chart ([eee7e47](https://github.com/marcolongol/nx-extensions/commit/eee7e47))
- ⚠️  **helm:** name chart template helpers after the chart ([f8f1cba](https://github.com/marcolongol/nx-extensions/commit/f8f1cba))
- ⚠️  **helm:** flatten and rename the package executor options ([19048b0](https://github.com/marcolongol/nx-extensions/commit/19048b0))
- ⚠️  **helm:** move the Helm client into the plugin and harden it ([aaa233d](https://github.com/marcolongol/nx-extensions/commit/aaa233d))
- ⚠️  **helm:** sync chart generator template with Helm v4 `helm create` ([9850422](https://github.com/marcolongol/nx-extensions/commit/9850422))
- **helm:** add plainHttp option to the package executor ([00bce8d](https://github.com/marcolongol/nx-extensions/commit/00bce8d))

### 🩹 Fixes

- **helm:** sort the umbrella chart choices with a compare function ([ac770d4](https://github.com/marcolongol/nx-extensions/commit/ac770d4))
- **helm:** depend on @nx-extensions/core with a caret range ([4ca43e7](https://github.com/marcolongol/nx-extensions/commit/4ca43e7))
- **helm:** keep chart templates away from the formatter ([3e432e7](https://github.com/marcolongol/nx-extensions/commit/3e432e7))
- **helm:** make the dependency generator update Chart.yaml reliably ([18376f4](https://github.com/marcolongol/nx-extensions/commit/18376f4))
- **helm:** resolve executor paths against the workspace root ([a86851e](https://github.com/marcolongol/nx-extensions/commit/a86851e))
- **helm:** format output, sanitize chart names and ignore chart templates ([018d7cf](https://github.com/marcolongol/nx-extensions/commit/018d7cf))
- **helm:** accept @nx/devkit 22 through 24 as peer dependency ([9ac0151](https://github.com/marcolongol/nx-extensions/commit/9ac0151))
- **deps:** update nx monorepo to v22.7.2 ([#441](https://github.com/marcolongol/nx-extensions/pull/441))
- **deps:** update nx monorepo to v22.7.1 ([#430](https://github.com/marcolongol/nx-extensions/pull/430))
- **deps:** update nx monorepo to v22.7.0 ([#427](https://github.com/marcolongol/nx-extensions/pull/427))
- **deps:** update nx monorepo to v22.6.5 ([#410](https://github.com/marcolongol/nx-extensions/pull/410))
- **deps:** update nx monorepo to v22.6.3 ([#406](https://github.com/marcolongol/nx-extensions/pull/406))
- **deps:** update nx monorepo to v22.6.2 ([#405](https://github.com/marcolongol/nx-extensions/pull/405))
- **deps:** update nx monorepo to v22.6.1 ([#398](https://github.com/marcolongol/nx-extensions/pull/398))
- **deps:** update nx monorepo to v22.6.0 ([#396](https://github.com/marcolongol/nx-extensions/pull/396))
- **deps:** update nx monorepo to v22.5.4 ([#384](https://github.com/marcolongol/nx-extensions/pull/384))
- **deps:** update nx monorepo to v22.5.3 ([#379](https://github.com/marcolongol/nx-extensions/pull/379))
- **deps:** update nx monorepo to v22.5.2 ([#369](https://github.com/marcolongol/nx-extensions/pull/369))
- **deps:** update nx monorepo to v22.5.1 ([#365](https://github.com/marcolongol/nx-extensions/pull/365))
- **deps:** update nx monorepo to v22.5.0 ([#363](https://github.com/marcolongol/nx-extensions/pull/363))
- **deps:** update nx monorepo to v22.4.5 ([#356](https://github.com/marcolongol/nx-extensions/pull/356))
- **deps:** update nx monorepo to v22.4.4 ([#353](https://github.com/marcolongol/nx-extensions/pull/353))
- **deps:** update nx monorepo to v22.4.3 ([#350](https://github.com/marcolongol/nx-extensions/pull/350))
- **deps:** update nx monorepo to v22.4.2 ([#347](https://github.com/marcolongol/nx-extensions/pull/347))
- **deps:** update nx monorepo to v22.4.1 ([#345](https://github.com/marcolongol/nx-extensions/pull/345))
- **deps:** update nx monorepo to v22.4.0 ([#344](https://github.com/marcolongol/nx-extensions/pull/344))
- **deps:** update nx monorepo to v22.3.3 ([#326](https://github.com/marcolongol/nx-extensions/pull/326))
- **deps:** update nx monorepo to v22.3.0 ([#324](https://github.com/marcolongol/nx-extensions/pull/324))
- **deps:** update nx monorepo to v22.2.6 ([#322](https://github.com/marcolongol/nx-extensions/pull/322))
- **deps:** update nx monorepo to v22.2.5 ([#313](https://github.com/marcolongol/nx-extensions/pull/313))
- **deps:** update nx monorepo to v22.1.3 ([#301](https://github.com/marcolongol/nx-extensions/pull/301))
- **deps:** update nx monorepo to v22.1.2 ([#297](https://github.com/marcolongol/nx-extensions/pull/297))
- **deps:** update nx monorepo to v22.1.1 ([#294](https://github.com/marcolongol/nx-extensions/pull/294))
- **deps:** update nx monorepo to v22.1.0 ([#291](https://github.com/marcolongol/nx-extensions/pull/291))
- **deps:** update nx monorepo to v22.0.4 ([#290](https://github.com/marcolongol/nx-extensions/pull/290))
- **deps:** update nx monorepo to v22.0.3 ([#285](https://github.com/marcolongol/nx-extensions/pull/285))
- **deps:** update nx monorepo to v22.0.2 ([#174](https://github.com/marcolongol/nx-extensions/pull/174))

### ⚠️  Breaking Changes

- **helm:** support the current and previous Nx major only  ([ab69070](https://github.com/marcolongol/nx-extensions/commit/ab69070))
  Nx 22 is no longer supported. Update the workspace to
  Nx 23 or later with nx migrate before updating the plugin.
- **helm:** name chart template helpers after the chart  ([f8f1cba](https://github.com/marcolongol/nx-extensions/commit/f8f1cba))
  newly generated charts use <name>.fullname etc. instead
  of chart.fullname. Existing charts are not changed.
- **helm:** flatten and rename the package executor options  ([19048b0](https://github.com/marcolongol/nx-extensions/commit/19048b0))
  the package executor's version option is now
  chartVersion, and dependencies.{update,build,repositories} are now
  updateDependencies, buildDependencies and repositories, with new
  defaults. Run `nx migrate` to update existing targets.
- **helm:** move the Helm client into the plugin and harden it  ([aaa233d](https://github.com/marcolongol/nx-extensions/commit/aaa233d))
  the package executor adds repositories to a
  workspace-local Helm repository config instead of the global one.
  Charts that relied on repositories added to the global Helm config must
  declare them in the helm target's repositories, or set
  HELM_REPOSITORY_CONFIG.
- **helm:** sync chart generator template with Helm v4 `helm create`  ([9850422](https://github.com/marcolongol/nx-extensions/commit/9850422))
  generated charts no longer render Ingress for
  Kubernetes clusters older than 1.19 (extensions/v1beta1 and
  networking.k8s.io/v1beta1).

### 🧱 Updated Dependencies

- Updated core to 2.0.0

### ❤️ Thank You

- Lucas Marcolongo

## 1.1.0 (2025-10-24)

### 🚀 Features

- **helm:** Support overwriting chart version and app version ([94b7645](https://github.com/marcolongol/nx-extensions/commit/94b7645))

### 🧱 Updated Dependencies

- Updated core to 1.0.2

### ❤️ Thank You

- Ian Serpa

## 1.0.1 (2025-10-24)

### 🩹 Fixes

- **helm-e2e:** fix tests (disable nx daemon & update dependencies by default) ([5d5d1ef](https://github.com/marcolongol/nx-extensions/commit/5d5d1ef))

### 🧱 Updated Dependencies

- Updated core to 1.0.1

### ❤️ Thank You

- Lucas Marcolongo @marcolongol

# 1.0.0 (2024-10-22)

### 🩹 Fixes

- **helm:** fix tests ([022a434](https://github.com/marcolongol/nx-extensions/commit/022a434))
- **helm:** fix peer dep resolution ([bc836db](https://github.com/marcolongol/nx-extensions/commit/bc836db))

### 🧱 Updated Dependencies

- Updated core to 1.0.0

### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.7.1 (2024-08-29)


### 🩹 Fixes

- **helm:** fix peer dep resolution ([0603a49](https://github.com/marcolongol/nx-extensions/commit/0603a49))


### 🧱 Updated Dependencies

- Updated core to 0.3.1


### ❤️  Thank You

- Lucas Marcolongo

## 0.7.0 (2024-08-13)


### 🚀 Features

- **helm:** support chart dependencies update/build ([e4e4585](https://github.com/marcolongol/nx-extensions/commit/e4e4585))

- **helm:** add `dependency` generator ([4a6fc29](https://github.com/marcolongol/nx-extensions/commit/4a6fc29))


### 🧱 Updated Dependencies

- Updated core to 0.3.0


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.6.2 (2024-08-09)


### 🩹 Fixes

- **helm:** move `@nx/devkit` to `peerDependencies` ([68e2ab1](https://github.com/marcolongol/nx-extensions/commit/68e2ab1))

- **helm:** use `{workspaceRoot}/dist/charts/{projectRoot}` as default output folder ([221387a](https://github.com/marcolongol/nx-extensions/commit/221387a))

- **helm:** fix `format` option description and prompt ([78a1b0f](https://github.com/marcolongol/nx-extensions/commit/78a1b0f))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.6.1 (2024-08-08)


### 🩹 Fixes

- **deps:** update nrwl monorepo to v19.5.7 ([7c04f5e](https://github.com/marcolongol/nx-extensions/commit/7c04f5e))

- **helm:** move `@nx/devkit` to `peerDependencies` ([65a06b4](https://github.com/marcolongol/nx-extensions/commit/65a06b4))

- **helm:** use `{workspaceRoot}/dist/charts/{projectRoot}` as default output folder ([0a41aef](https://github.com/marcolongol/nx-extensions/commit/0a41aef))

- **helm:** fix `format` option description and prompt ([8120f6d](https://github.com/marcolongol/nx-extensions/commit/8120f6d))


### 🧱 Updated Dependencies

- Updated core to 0.2.1


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.6.0 (2024-08-07)


### 🚀 Features

- **helm:** use helm wrapper from `@nx-extensions/core` ([2e5be3f](https://github.com/marcolongol/nx-extensions/commit/2e5be3f))


### 🩹 Fixes

- **helm:** use `format` instead of `skipFormat` and default to false ([ca8d6f6](https://github.com/marcolongol/nx-extensions/commit/ca8d6f6))


### 🧱 Updated Dependencies

- Updated core to 0.2.0


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.5.0 (2024-08-07)


### 🚀 Features

- **helm:** add `formatFiles` to `chart` generator ([bc62dd2](https://github.com/marcolongol/nx-extensions/commit/bc62dd2))

- **helm:** add `skipFormat` option to `chart` generator ([5e54ca8](https://github.com/marcolongol/nx-extensions/commit/5e54ca8))

- **helm:** use helm wrapper from `@nx-extensions/core` ([038e978](https://github.com/marcolongol/nx-extensions/commit/038e978))


### 🩹 Fixes

- **helm:** use `format` instead of `skipFormat` and default to false ([cb66233](https://github.com/marcolongol/nx-extensions/commit/cb66233))


### 🧱 Updated Dependencies

- Updated core to 0.1.0


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.4.0 (2024-08-06)


### 🚀 Features

- **helm:** add repository information to `packages.json` ([92e4dee](https://github.com/marcolongol/nx-extensions/commit/92e4dee))

- **helm:** add `formatFiles` to `chart` generator ([5e6cee9](https://github.com/marcolongol/nx-extensions/commit/5e6cee9))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.3.0 (2024-08-05)


### 🚀 Features

- **helm:** add repository information to `packages.json` ([82f1c9b](https://github.com/marcolongol/nx-extensions/commit/82f1c9b))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.2.0 (2024-08-05)


### 🚀 Features

- **helm:** abort chart generation if target is already defined ([ac15994](https://github.com/marcolongol/nx-extensions/commit/ac15994))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.1.0 (2024-08-05)


### 🚀 Features

- **helm:** add chart generator ([c156ced](https://github.com/marcolongol/nx-extensions/commit/c156ced))

- **helm:** add package executor ([702f88a](https://github.com/marcolongol/nx-extensions/commit/702f88a))

- **helm:** enable to push chart to remote ([f194ea8](https://github.com/marcolongol/nx-extensions/commit/f194ea8))


### 🩹 Fixes

- **helm:** fix chart generator tests ([59c6811](https://github.com/marcolongol/nx-extensions/commit/59c6811))

- **helm-e2e:** add cross platform setup and teardown module refs ([68ddc6a](https://github.com/marcolongol/nx-extensions/commit/68ddc6a))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol