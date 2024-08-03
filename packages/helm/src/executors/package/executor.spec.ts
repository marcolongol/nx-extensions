import { ExecutorContext } from '@nx/devkit';

import executor from './executor';
import { PackageExecutorSchema } from './schema.d';

const options: PackageExecutorSchema = {
  chartFolder: 'chart',
  outputFolder: 'chart',
  publish: false,
};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Package Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});
