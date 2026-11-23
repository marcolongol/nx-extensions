# 2.0.0 (2026-11-23)

### 🚀 Features

- ⚠️  **helm:** support the current and previous Nx major only ([ab69070](https://github.com/marcolongol/nx-extensions/commit/ab69070))
- **core:** add a command runner ([321da88](https://github.com/marcolongol/nx-extensions/commit/321da88))

### 🩹 Fixes

- **core:** add path containment helpers and make @nx/devkit a peer ([948af9d](https://github.com/marcolongol/nx-extensions/commit/948af9d))
- **core:** make addToPrettierIgnore update the workspace .prettierignore ([69c3578](https://github.com/marcolongol/nx-extensions/commit/69c3578))
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

### 💅 Refactors

- ⚠️  **core:** remove the Helm client ([014c85a](https://github.com/marcolongol/nx-extensions/commit/014c85a))

### ⚠️  Breaking Changes

- **helm:** support the current and previous Nx major only  ([ab69070](https://github.com/marcolongol/nx-extensions/commit/ab69070))
  Nx 22 is no longer supported. Update the workspace to
  Nx 23 or later with nx migrate before updating the plugin.
- **core:** remove the Helm client  ([014c85a](https://github.com/marcolongol/nx-extensions/commit/014c85a))
  @nx-extensions/core no longer exports HelmClient,
  createHelmClient, AbstractHelmClient or ensureInitialized, and no longer
  depends on @actions/exec. Use runCommand to run commands.

### ❤️ Thank You

- Lucas Marcolongo

## 1.0.2 (2025-10-24)

### 🚀 Features

- **helm:** Support overwriting chart version and app version ([94b7645](https://github.com/marcolongol/nx-extensions/commit/94b7645))

### ❤️ Thank You

- Ian Serpa

## 1.0.1 (2025-10-24)

This was a version bump only for core to align it with other projects, there were no code changes.

# 1.0.0 (2024-10-22)

### 🩹 Fixes

- **core:** fix peer dep resolution ([8c5fd9c](https://github.com/marcolongol/nx-extensions/commit/8c5fd9c))

### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.3.1 (2024-08-29)


### 🩹 Fixes

- **core:** fix peer dep resolution ([3877259](https://github.com/marcolongol/nx-extensions/commit/3877259))


### ❤️  Thank You

- Lucas Marcolongo

## 0.3.0 (2024-08-13)


### 🚀 Features

- **core:** add helm utilities to handle chart dependencies ([35d28e1](https://github.com/marcolongol/nx-extensions/commit/35d28e1))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.2.1 (2024-08-08)


### 🩹 Fixes

- **core:** add `publishConfig` to `package.json` ([954eb70](https://github.com/marcolongol/nx-extensions/commit/954eb70))

- **deps:** update nrwl monorepo to v19.5.7 ([7c04f5e](https://github.com/marcolongol/nx-extensions/commit/7c04f5e))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.2.0 (2024-08-07)


### 🚀 Features

- **core:** bootstrap `@nx-extensions/core` library ([96b3044](https://github.com/marcolongol/nx-extensions/commit/96b3044))

- **core:** port helm wrapper code to `@nx-extensions/core` ([1c800a2](https://github.com/marcolongol/nx-extensions/commit/1c800a2))

- **core:** add `addToPrettierIgnore` util function ([4e42392](https://github.com/marcolongol/nx-extensions/commit/4e42392))


### 🩹 Fixes

- **core:** add `publishConfig` to `package.json` ([ccca913](https://github.com/marcolongol/nx-extensions/commit/ccca913))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol

## 0.1.0 (2024-08-07)


### 🚀 Features

- **core:** bootstrap `@nx-extensions/core` library ([d2d0d19](https://github.com/marcolongol/nx-extensions/commit/d2d0d19))

- **core:** port helm wrapper code to `@nx-extensions/core` ([9603cb9](https://github.com/marcolongol/nx-extensions/commit/9603cb9))

- **core:** add `addToPrettierIgnore` util function ([8c6e01d](https://github.com/marcolongol/nx-extensions/commit/8c6e01d))


### ❤️  Thank You

- Lucas Marcolongo @marcolongol