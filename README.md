# `@nx-extensions`

A Collection of Nx plugins for various tools and frameworks.

## Plugins

| Plugin                                 | Description                                |
| -------------------------------------- | ------------------------------------------ |
| [@nx-extensions/helm](./packages/helm) | First class support for Helm charts in Nx. |

## Development

The repository uses [pnpm](https://pnpm.io) workspaces; the version is pinned in `packageManager`.

```bash
pnpm install
pnpm exec nx run-many -t lint test build
pnpm exec nx run helm-e2e:e2e # needs Docker and Helm
```

Dependency install scripts are denied in `pnpm-workspace.yaml` (`allowBuilds`). If a new dependency needs one, `pnpm install` stops and asks; allow it there only if it's really needed.

## Releasing

Versions and changelogs come from [conventional commits](https://www.conventionalcommits.org): `fix` is a patch, `feat` a minor and a `!` or `BREAKING CHANGE:` footer a major. Each package is versioned on its own.

1. Run the **Release** workflow from `main`. It defaults to a dry run that prints the new versions, changelogs and what would be published.
2. Run it again with **Dry run** unticked. The `version` job bumps the versions, updates the changelogs, commits, tags and creates the GitHub releases. The `publish` job then waits for approval on the `npm` environment and publishes with npm trusted publishing and provenance.

One-time setup:

- A GitHub App for releases with Contents read and write, installed on this repository and allowed to bypass the `main` ruleset. Store its App ID as the `RELEASE_APP_ID` variable and its private key as the `RELEASE_APP_PRIVATE_KEY` secret in a `release` environment that only `main` can use.
- An `npm` environment with a required reviewer, also limited to `main`.
- On npmjs.com, a trusted publisher for each package: repository `marcolongol/nx-extensions`, workflow `release.yml`, environment `npm`.

## Authors

- [Lucas Marcolongo](https://marcolongo.cloud)

## License

[MIT](./LICENSE)
