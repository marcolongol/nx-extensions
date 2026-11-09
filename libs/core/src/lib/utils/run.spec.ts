import { CommandError, redactArgs, runCommand } from './run';

const node = process.execPath;

describe('runCommand', () => {
  let stdoutWrite: jest.SpyInstance;

  beforeEach(() => {
    stdoutWrite = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns stdout and stderr', async () => {
    await expect(
      runCommand(node, [
        '-e',
        'process.stdout.write("out"); process.stderr.write("err")',
      ]),
    ).resolves.toEqual({ stdout: 'out', stderr: 'err' });
  });

  it('rejects with the exit code and stderr on failure', async () => {
    const result = runCommand(node, [
      '-e',
      'process.stderr.write("broken"); process.exit(3)',
    ]);

    await expect(result).rejects.toBeInstanceOf(CommandError);
    await expect(result).rejects.toMatchObject({
      exitCode: 3,
      stderr: 'broken',
      message: expect.stringMatching(/failed with exit code 3: broken$/),
    });
  });

  it('passes arguments without a shell', async () => {
    const { stdout } = await runCommand(node, [
      '-e',
      'process.stdout.write(process.argv[1])',
      '$(echo nope); rm -rf /',
    ]);

    expect(stdout).toBe('$(echo nope); rm -rf /');
  });

  it('logs the command line with credentials redacted', async () => {
    await runCommand(node, ['-e', '', 'https://user:secret@example.com/x']);

    expect(stdoutWrite).toHaveBeenCalledWith(
      `> ${node} -e  https://***@example.com/x\n`,
    );
  });

  it('writes input to stdin without logging it', async () => {
    const { stdout } = await runCommand(
      node,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      { input: 'secret-password' },
    );

    expect(stdout).toBe('secret-password');
    // Only the command line is logged, and it doesn't contain the input
    expect(
      stdoutWrite.mock.calls.filter(([line]) => String(line).startsWith('> ')),
    ).toEqual([[`> ${node} -e process.stdin.pipe(process.stdout)\n`]]);
  });

  it('logs nothing when silent', async () => {
    await runCommand(node, ['-e', 'process.stdout.write("out")'], {
      silent: true,
    });

    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it('explains a missing command', async () => {
    await expect(runCommand('definitely-not-a-command', [])).rejects.toThrow(
      'definitely-not-a-command was not found. Is it installed and on PATH?',
    );
  });
});

describe('redactArgs', () => {
  it('hides URL credentials and explicit secrets', () => {
    expect(
      redactArgs(
        ['repo', 'add', 'x', 'https://user:pass@charts.example.com', 'tok123'],
        ['tok123'],
      ),
    ).toEqual(['repo', 'add', 'x', 'https://***@charts.example.com', '***']);
  });

  it('leaves arguments without credentials alone', () => {
    expect(redactArgs(['push', 'oci://localhost:5000/charts'])).toEqual([
      'push',
      'oci://localhost:5000/charts',
    ]);
  });
});
