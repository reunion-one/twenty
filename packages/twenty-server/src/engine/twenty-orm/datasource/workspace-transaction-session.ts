import { Logger } from '@nestjs/common';

import { type PoolClient } from 'pg';

import { computeTwentyOrmException } from 'src/engine/twenty-orm/error-handling/compute-twenty-orm-exception.util';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { type WorkspaceTransactionSessionState } from 'src/engine/twenty-orm/types/workspace-transaction-session-state.type';

class AsyncMutex {
  private tail = Promise.resolve();

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;

    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await work();
    } finally {
      release();
    }
  }
}

export class WorkspaceTransactionSession {
  private readonly logger = new Logger(WorkspaceTransactionSession.name);
  private readonly mutex = new AsyncMutex();
  private readonly client: PoolClient;
  private readonly afterCommitCallbacks: Array<() => void | Promise<void>>;
  private state: WorkspaceTransactionSessionState = 'OPEN';
  private released = false;

  constructor({
    client,
    scope,
    afterCommitCallbacks,
  }: {
    client: PoolClient;
    scope: WorkspaceTransactionScope;
    afterCommitCallbacks: Array<() => void | Promise<void>>;
  }) {
    this.client = client;
    this.scope = scope;
    this.afterCommitCallbacks = afterCommitCallbacks;
  }

  readonly scope: WorkspaceTransactionScope;

  getState(): WorkspaceTransactionSessionState {
    return this.state;
  }

  markAborted(): void {
    if (this.state === 'OPEN') {
      this.state = 'ABORTED';
    }
  }

  runExclusive<T>(work: () => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(work);
  }

  async commit(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (this.state === 'COMMITTED') {
        return;
      }

      if (this.state !== 'OPEN') {
        throw new Error('Workspace transaction session is not open');
      }

      this.state = 'COMMITTING';

      try {
        await this.client.query('COMMIT');
      } catch (error) {
        this.state = 'FAILED';
        await this.release(true);

        throw computeTwentyOrmException(error);
      }

      this.state = 'COMMITTED';
      await this.release();
      await this.runAfterCommitCallbacks();
    });
  }

  async rollback(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (this.state === 'ROLLED_BACK' || this.state === 'EXPIRED') {
        return;
      }

      if (this.state === 'COMMITTED') {
        throw new Error('Workspace transaction session is already committed');
      }

      if (this.state === 'FAILED') {
        throw new Error('Workspace transaction session has failed');
      }

      this.state = 'ROLLING_BACK';

      try {
        await this.client.query('ROLLBACK');
        this.state = 'ROLLED_BACK';
        this.afterCommitCallbacks.length = 0;
        await this.release();
      } catch (error) {
        this.state = 'FAILED';
        this.afterCommitCallbacks.length = 0;
        await this.release(true);

        throw computeTwentyOrmException(error);
      }
    });
  }

  async expire(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      if (this.state === 'EXPIRED' || this.state === 'FAILED') {
        return;
      }

      if (this.state === 'COMMITTED' || this.state === 'ROLLED_BACK') {
        return;
      }

      this.state = 'ROLLING_BACK';

      try {
        await this.client.query('ROLLBACK');
        this.state = 'EXPIRED';
        this.afterCommitCallbacks.length = 0;
        await this.release();
      } catch (error) {
        this.state = 'FAILED';
        this.afterCommitCallbacks.length = 0;
        await this.release(true);

        throw computeTwentyOrmException(error);
      }
    });
  }

  private async release(destroy = false): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;
    this.client.release(destroy);
  }

  private async runAfterCommitCallbacks(): Promise<void> {
    for (const callback of this.afterCommitCallbacks.splice(0)) {
      try {
        await callback();
      } catch (error) {
        this.logger.error(
          `After-commit callback failed for workspace ${this.scope.workspaceId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
