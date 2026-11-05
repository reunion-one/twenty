import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildLocalChildProcessNodeFlags } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/utils/build-local-child-process-node-flags.util';

describe('buildLocalChildProcessNodeFlags @custom', () => {
  it('grants unrestricted file reads and writes', () => {
    expect(
      buildLocalChildProcessNodeFlags({
        readableDirectories: ['/execution', '/layers/deps', '/layers/sdk'],
        shouldAllowNetwork: false,
      }),
    ).toEqual([
      '--permission',
      '--allow-addons',
      '--disable-warning=SecurityWarning',
      '--allow-fs-read=/execution',
      '--allow-fs-read=/layers/deps',
      '--allow-fs-read=/layers/sdk',
      '--allow-fs-read=*',
      '--allow-fs-write=*',
    ]);
  });

  it('lets the child write outside its execution directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'twenty-file-permissions-'));
    const outputPath = join(directory, 'outside-execution.txt');

    try {
      const child = spawnSync(
        process.execPath,
        [
          ...buildLocalChildProcessNodeFlags({
            readableDirectories: [join(directory, 'execution')],
            shouldAllowNetwork: false,
          }),
          '-e',
          "require('node:fs').writeFileSync(process.argv[1], 'written')",
          outputPath,
        ],
        { encoding: 'utf8' },
      );

      expect(child.stderr).toBe('');
      expect(child.status).toBe(0);
      expect(readFileSync(outputPath, 'utf8')).toBe('written');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps network access when requested', () => {
    expect(
      buildLocalChildProcessNodeFlags({
        readableDirectories: ['/execution'],
        shouldAllowNetwork: true,
      }),
    ).toContain('--allow-net');
  });
});
