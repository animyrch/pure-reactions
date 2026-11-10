import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('firebase admin auth on the function runtime', () => {
  it('loads getAuth when Node cannot require an ES module', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        '--no-experimental-require-module',
        '--input-type=module',
        '-e',
        [
          "import { getAuth } from 'firebase-admin/auth';",
          "if (typeof getAuth !== 'function') throw new Error('getAuth missing');",
          "console.log('ok');"
        ].join('\n')
      ],
      { cwd: process.cwd() }
    );

    expect(stdout.trim()).toBe('ok');
  });
});
