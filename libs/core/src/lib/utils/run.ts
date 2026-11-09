import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  /** Replaces the environment of the command; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Values to hide in the logged command line, e.g. tokens passed as flags. */
  redact?: string[];
  /** Don't log the command line or forward its output. */
  silent?: boolean;
  /** Written to the command's stdin, e.g. a password for --password-stdin. */
  input?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

/** A command that ran but exited with a non-zero code. */
export class CommandError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly stderr: string,
  ) {
    const output = stderr.trim();
    super(
      `${command} failed with exit code ${exitCode}${output ? `: ${output}` : ''}`,
    );
    this.name = 'CommandError';
  }
}

/**
 * Hides the credentials in URLs (`https://user:pass@host`) and any `redact`
 * values, so a command line can be logged safely.
 *
 * @param {string[]} args
 * @param {string[]} redact
 * @returns {string[]}
 */
export function redactArgs(args: string[], redact: string[] = []): string[] {
  return args.map((arg) => {
    let value = arg.replace(/(\w+:\/\/)[^/@\s]+@/g, '$1***@');
    for (const secret of redact) {
      if (secret) {
        value = value.split(secret).join('***');
      }
    }
    return value;
  });
}

/**
 * Runs a command without a shell, so arguments are never interpreted by one.
 * Output is shown as it arrives and also returned. Rejects with a
 * {@link CommandError} when the command exits with a non-zero code.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {RunOptions} options
 * @returns {Promise<RunResult>}
 */
export function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<RunResult> {
  const commandLine = [command, ...redactArgs(args, options.redact)].join(' ');
  if (!options.silent) {
    process.stdout.write(`> ${commandLine}\n`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    if (options.input !== undefined) {
      child.stdin?.end(options.input);
    }

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (!options.silent) {
        process.stdout.write(chunk);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (!options.silent) {
        process.stderr.write(chunk);
      }
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'ENOENT'
          ? new Error(`${command} was not found. Is it installed and on PATH?`)
          : error,
      );
    });
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new CommandError(commandLine, exitCode, stderr));
      }
    });
  });
}
