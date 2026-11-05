import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalChildProcessRunnerService } from 'src/engine/core-modules/logic-function/logic-function-drivers/drivers/local/services/local-child-process-runner.service';

describe('local logic function capabilities @custom', () => {
  it('allows file access, subprocesses, and workers in the actual function runner', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'twenty-capabilities-'));
    const outputPath = join(directory, 'outside-temporary-directory.txt');
    const handlerPath = join(directory, 'handler.mjs');
    const runner = new LocalChildProcessRunnerService();

    try {
      await writeFile(
        handlerPath,
        `
        import { writeFileSync } from 'node:fs';
        import { execFileSync } from 'node:child_process';
        import { Worker } from 'node:worker_threads';
        export const handler = async ({ outputPath }) => {
          writeFileSync(outputPath, 'written');
          const subprocess = execFileSync(process.execPath, ['-p', '40 + 2'], { encoding: 'utf8' }).trim();
          const worker = await new Promise((resolve, reject) => {
            const thread = new Worker("require('node:worker_threads').parentPort.postMessage('worker-ok')", { eval: true });
            thread.once('message', resolve);
            thread.once('error', reject);
          });
          return { subprocess, worker, permissionModelEnabled: Boolean(process.permission) };
        };
      `,
      );
      const runnerPath = await runner.writeBootstrapRunner({
        dir: directory,
        builtFileAbsPath: handlerPath,
        handlerName: 'handler',
      });
      const result = await runner.runChildWithEnv({
        runnerPath,
        executionDirectory: directory,
        env: {},
        payload: { outputPath },
        context: {
          retryCount: 0,
          maxRetries: 0,
          workspaceId: 'workspace-id',
          userWorkspaceId: null,
          workspaceMemberId: null,
        },
        timeoutMs: 10000,
      });

      expect(result).toMatchObject({
        ok: true,
        result: {
          subprocess: '42',
          worker: 'worker-ok',
          permissionModelEnabled: false,
        },
      });
      expect(await readFile(outputPath, 'utf8')).toBe('written');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
