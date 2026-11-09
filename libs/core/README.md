# `@nx-extensions/core`

Shared utilities for the `@nx-extensions` Nx plugins. It is published so the plugins can depend on it; it is not meant as a general-purpose library.

- `runCommand(command, args, options)` runs a command without a shell, shows its output as it arrives and returns it. The logged command line has credentials in URLs redacted. A non-zero exit rejects with a `CommandError` carrying the exit code and stderr.
- `isPathInside(parent, target)` and `resolvePathInside(root, target, label)` check that an option value doesn't point outside the workspace or project.
- `addToPrettierIgnore(tree, entries)` adds entries to the workspace `.prettierignore` from a generator, leaving existing content as it is.

It needs `@nx/devkit` 22 to 24 as a peer dependency.
