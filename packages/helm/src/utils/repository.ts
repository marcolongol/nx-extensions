import { logger } from '@nx/devkit';

export type RepositoryKind = 'oci' | 'file' | 'http' | 'https';

/**
 * Validates a chart repository URL and tells what kind it is.
 *
 * - Credentials in the URL are rejected: they would end up in project.json and
 *   Chart.yaml. Use the repository's `username` and `passwordEnv`.
 * - Plain `http://` works, but logs a warning: anyone on the network path could
 *   swap the charts.
 */
export function checkRepositoryUrl(url: string): RepositoryKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`"${url}" is not a valid repository URL.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      `Repository URL "${parsed.protocol}//***@${parsed.host}${parsed.pathname}" contains credentials. Set the repository's username and passwordEnv instead.`,
    );
  }

  switch (parsed.protocol) {
    case 'oci:':
      return 'oci';
    case 'file:':
      return 'file';
    case 'https:':
      return 'https';
    case 'http:':
      logger.warn(
        `Repository "${url}" uses plain HTTP, so its charts could be tampered with on the way. Use https:// if the server supports it.`,
      );
      return 'http';
    default:
      throw new Error(
        `Repository URL "${url}" must use https://, http://, oci:// or file://.`,
      );
  }
}
