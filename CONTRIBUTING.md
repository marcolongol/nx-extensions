# Contributing

Thanks for helping out! Issues and pull requests are welcome.

## Setup

The repository is an Nx workspace that uses [pnpm](https://pnpm.io) workspaces; the pnpm version is pinned in `packageManager` in `package.json`.

```bash
pnpm install
```

Dependency install scripts are denied in `pnpm-workspace.yaml` (`allowBuilds`). If a new dependency needs one, `pnpm install` stops and asks; only allow it there if it's really needed.

## Checks

Run these before opening a pull request; CI runs the same ones:

```bash
pnpm exec nx run-many -t lint test build
pnpm exec nx format:check
```

The end-to-end tests create a fresh Nx workspace, install the plugin from a local registry and package and push a chart. They need [Helm](https://helm.sh/docs/intro/install/) and Docker:

```bash
pnpm exec nx run helm-e2e:e2e
```

Set `E2E_KEEP_WORKSPACE=true` to keep the test workspace for debugging.

## Commit messages

Commits follow [conventional commits](https://www.conventionalcommits.org), because releases are versioned and their changelogs written from them. Each package is versioned on its own:

- `fix(helm): ...` is a patch release of the package in the scope.
- `feat(helm): ...` is a minor release.
- A `!` after the scope, or a `BREAKING CHANGE:` footer explaining what breaks, is a major release.

Changes that users don't see, such as tooling or CI, use `chore`, `ci`, `test` or `docs`.

## Releases

Maintainers publish releases with the Release workflow.
