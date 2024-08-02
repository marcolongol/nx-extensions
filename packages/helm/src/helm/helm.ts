import { getExecOutput } from '@actions/exec';

/**
 * Abstract class for Helm
 */
abstract class AbstractHelmClient {
  abstract package(): void;
}

/**
 * Options for packaging a chart
 */
interface PackageOptions {
  chartFolder: string;
  outputFolder: string;
}

/**
 * Decorator to ensure Helm is initialized before executing a method
 * @param {any} target
 * @param {string} propertyKey
 * @param {PropertyDescriptor} descriptor
 * @returns {PropertyDescriptor}
 */
const ensureInitialized = (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor => {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    if (!this.initialized) {
      await this.initialize();
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Create a new Helm client instance
 * @returns {HelmClient}
 */
export const createHelmClient = (): HelmClient => {return new HelmClient();};

/**
 * Helm wrapper class
 * @export
 * @class Helm
 * @extends {HelmAdapter}
 */
export class HelmClient extends AbstractHelmClient {
  private initialized = false;

  /**
   * Package a chart directory into a chart archive
   * @param {PackageOptions} [options]
   */
  @ensureInitialized
  public async package(options?: PackageOptions): Promise<void> {
    await getExecOutput('helm', [
      'package',
      options.chartFolder,
      '-d',
      options.outputFolder,
    ]).then((output) => {
      if (output.stderr.length > 0 && output.exitCode !== 0) {
        throw new Error(`Failed to package chart: ${output.stderr}`);
      }
    });
  }

  /**
   * Initialize Helm
   * @returns {Promise<void>}
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await getExecOutput('helm', ['version']).then((output) => {
      if (output.stderr.length > 0 && output.exitCode !== 0) {
        throw new Error(`Helm is not installed: ${output.stderr}`);
      }
      this.initialized = true;
    });
  }
}
