import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { randomBytes } from 'crypto';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import {
  WorkspaceTransactionSessionException,
  WorkspaceTransactionSessionExceptionCode,
} from 'src/engine/core-modules/workspace-transaction-session/exceptions/workspace-transaction-session.exception';
import { buildWorkspaceTransactionPrincipalKey } from 'src/engine/core-modules/workspace-transaction-session/utils/build-workspace-transaction-principal-key.util';
import { type ManagedWorkspaceTransaction } from 'src/engine/core-modules/workspace-transaction-session/types/managed-workspace-transaction.type';
import { type WorkspaceTransactionSessionStatus } from 'src/engine/core-modules/workspace-transaction-session/types/workspace-transaction-session-status.type';
import { WorkspaceDataSourceService } from 'src/engine/twenty-orm/datasource/workspace-data-source.service';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { type WorkspaceTransactionSessionState } from 'src/engine/twenty-orm/types/workspace-transaction-session-state.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { withWorkspaceTransactionScope } from 'src/engine/core-modules/workspace-transaction-session/storage/workspace-transaction-context.storage';

const TERMINAL_STATE_CACHE_TTL_MS = 60_000;

type TerminalWorkspaceTransaction = Omit<
  ManagedWorkspaceTransaction,
  'session'
> & {
  terminalStateExpiresAt: Date;
};

@Injectable()
export class WorkspaceTransactionSessionManager implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceTransactionSessionManager.name);
  private readonly sessions = new Map<string, ManagedWorkspaceTransaction>();
  private readonly terminalSessions = new Map<
    string,
    TerminalWorkspaceTransaction
  >();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  onModuleInit(): void {
    this.workspaceDataSourceService.registerTransactionSessionShutdown(() =>
      this.shutdown(),
    );

    const cleanupInterval = Math.max(
      1_000,
      Math.min(
        this.twentyConfigService.get(
          'WORKSPACE_TRANSACTION_SESSION_IDLE_TIMEOUT_MS',
        ),
        60_000,
      ),
    );

    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions();
    }, cleanupInterval);
    this.cleanupTimer.unref?.();
  }

  async begin(
    authContext: WorkspaceAuthContext = getWorkspaceAuthContext(),
    metadataVersion = authContext.workspace.metadataVersion,
  ): Promise<WorkspaceTransactionSessionStatus> {
    const now = new Date();
    const session = await this.workspaceOrmManager.executeInWorkspaceContext(
      () => this.workspaceOrmManager.beginWorkspaceTransactionSession(),
      authContext,
    );
    const id = `tx_${randomBytes(24).toString('base64url')}`;
    const managedTransaction: ManagedWorkspaceTransaction = {
      id,
      workspaceId: authContext.workspace.id,
      principalKey: buildWorkspaceTransactionPrincipalKey(authContext),
      authType: authContext.type,
      metadataVersion,
      session,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(
        now.getTime() +
          this.twentyConfigService.get(
            'WORKSPACE_TRANSACTION_SESSION_MAX_LIFETIME_MS',
          ),
      ),
      state: session.getState(),
    };

    this.sessions.set(id, managedTransaction);
    this.logger.log(
      `Workspace transaction ${this.logId(id)} begun; active sessions: ${this.sessions.size}`,
    );

    return this.toStatus(managedTransaction);
  }

  getStatus(
    id: string,
    authContext: WorkspaceAuthContext = getWorkspaceAuthContext(),
  ): WorkspaceTransactionSessionStatus {
    const managedTransaction = this.sessions.get(id);

    if (managedTransaction) {
      this.assertOwnership(managedTransaction, authContext);
      managedTransaction.state = managedTransaction.session.getState();

      return this.toStatus(managedTransaction);
    }

    const terminalTransaction = this.terminalSessions.get(id);

    if (terminalTransaction) {
      this.assertOwnership(terminalTransaction, authContext);

      return this.toStatus(terminalTransaction);
    }

    throw this.exception(
      WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_FOUND,
      'Transaction session not found',
    );
  }

  async runWithSession<T>(
    id: string,
    authContext: WorkspaceAuthContext,
    work: (scope: WorkspaceTransactionScope) => T | Promise<T>,
    metadataVersion = authContext.workspace.metadataVersion,
  ): Promise<T> {
    const managedTransaction = this.sessions.get(id);

    if (!managedTransaction) {
      const terminalTransaction = this.terminalSessions.get(id);

      if (terminalTransaction) {
        this.assertOwnership(terminalTransaction, authContext);
        throw this.exceptionForState(terminalTransaction.state);
      }

      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_FOUND,
        'Transaction session not found',
      );
    }

    this.assertOwnership(managedTransaction, authContext);
    await this.expireIfNeeded(managedTransaction);
    await this.ensureMetadataVersion(managedTransaction, metadataVersion);
    this.touch(managedTransaction);

    try {
      const result = await managedTransaction.session.runExclusive(async () => {
        const state = managedTransaction.session.getState();

        if (state !== 'OPEN') {
          throw this.exceptionForState(state);
        }

        if (Date.now() >= managedTransaction.expiresAt.getTime()) {
          throw this.exception(
            WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED,
            'Transaction session expired',
          );
        }

        this.assertMetadataVersion(managedTransaction, metadataVersion);

        return withWorkspaceTransactionScope(
          managedTransaction.session.scope,
          () => work(managedTransaction.session.scope),
        );
      });

      this.touch(managedTransaction);

      return result;
    } catch (error) {
      managedTransaction.state = managedTransaction.session.getState();

      if (
        error instanceof WorkspaceTransactionSessionException &&
        (error.code ===
          WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED ||
          error.code ===
            WorkspaceTransactionSessionExceptionCode.TRANSACTION_METADATA_CHANGED)
      ) {
        await this.expireManagedTransaction(managedTransaction);
      }

      throw error;
    }
  }

  async commit(
    id: string,
    authContext: WorkspaceAuthContext = getWorkspaceAuthContext(),
    metadataVersion = authContext.workspace.metadataVersion,
  ): Promise<WorkspaceTransactionSessionStatus> {
    const managedTransaction = this.sessions.get(id);

    if (!managedTransaction) {
      return this.getStatus(id, authContext);
    }

    this.assertOwnership(managedTransaction, authContext);
    await this.expireIfNeeded(managedTransaction);
    await this.ensureMetadataVersion(managedTransaction, metadataVersion);

    const state = managedTransaction.session.getState();

    if (state === 'ABORTED') {
      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_ABORTED,
        'Transaction session is aborted',
      );
    }

    if (state === 'ROLLED_BACK' || state === 'EXPIRED' || state === 'FAILED') {
      this.finalize(managedTransaction);

      return this.toStatus(managedTransaction);
    }

    if (
      state !== 'OPEN' &&
      state !== 'COMMITTING' &&
      state !== 'ROLLING_BACK' &&
      state !== 'COMMITTED'
    ) {
      throw this.exceptionForState(state);
    }

    try {
      await managedTransaction.session.commit();
    } catch {
      managedTransaction.state = managedTransaction.session.getState();

      if (managedTransaction.state === 'ABORTED') {
        throw this.exception(
          WorkspaceTransactionSessionExceptionCode.TRANSACTION_ABORTED,
          'Transaction session is aborted',
        );
      }

      if (managedTransaction.state === 'FAILED') {
        this.finalize(managedTransaction);
      }

      if (
        managedTransaction.state === 'COMMITTED' ||
        managedTransaction.state === 'ROLLED_BACK' ||
        managedTransaction.state === 'EXPIRED'
      ) {
        this.finalize(managedTransaction);

        return this.toStatus(managedTransaction);
      }

      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_COMMIT_FAILED,
        'Transaction session commit failed',
      );
    }

    managedTransaction.state = managedTransaction.session.getState();
    managedTransaction.lastActivityAt = new Date();
    this.finalize(managedTransaction);
    this.logger.log(`Workspace transaction ${this.logId(id)} committed`);

    return this.toStatus(managedTransaction);
  }

  async rollback(
    id: string,
    authContext: WorkspaceAuthContext = getWorkspaceAuthContext(),
  ): Promise<WorkspaceTransactionSessionStatus> {
    const managedTransaction = this.sessions.get(id);

    if (!managedTransaction) {
      return this.getStatus(id, authContext);
    }

    this.assertOwnership(managedTransaction, authContext);

    const state = managedTransaction.session.getState();

    if (
      state === 'COMMITTED' ||
      state === 'ROLLED_BACK' ||
      state === 'EXPIRED' ||
      state === 'FAILED'
    ) {
      this.finalize(managedTransaction);

      return this.toStatus(managedTransaction);
    }

    try {
      await managedTransaction.session.rollback();
    } catch {
      managedTransaction.state = managedTransaction.session.getState();

      if (
        managedTransaction.state === 'COMMITTED' ||
        managedTransaction.state === 'ROLLED_BACK' ||
        managedTransaction.state === 'EXPIRED'
      ) {
        this.finalize(managedTransaction);

        return this.toStatus(managedTransaction);
      }

      this.finalize(managedTransaction);

      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_ROLLBACK_FAILED,
        'Transaction session rollback failed',
      );
    }

    managedTransaction.state = managedTransaction.session.getState();
    managedTransaction.lastActivityAt = new Date();
    this.finalize(managedTransaction);
    this.logger.log(`Workspace transaction ${this.logId(id)} rolled back`);

    return this.toStatus(managedTransaction);
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const activeSessions = [...this.sessions.values()];

    await Promise.all(
      activeSessions.map(async (managedTransaction) => {
        try {
          await managedTransaction.session.rollback();
        } catch {
          managedTransaction.state = managedTransaction.session.getState();
        } finally {
          this.sessions.delete(managedTransaction.id);
        }
      }),
    );
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();

    for (const [id, terminalTransaction] of this.terminalSessions) {
      if (terminalTransaction.terminalStateExpiresAt.getTime() <= now) {
        this.terminalSessions.delete(id);
      }
    }

    await Promise.all(
      [...this.sessions.values()]
        .filter(
          (managedTransaction) =>
            managedTransaction.expiresAt.getTime() <= now ||
            managedTransaction.lastActivityAt.getTime() +
              this.twentyConfigService.get(
                'WORKSPACE_TRANSACTION_SESSION_IDLE_TIMEOUT_MS',
              ) <=
              now,
        )
        .map((managedTransaction) =>
          this.expireManagedTransaction(managedTransaction),
        ),
    );
  }

  private async expireIfNeeded(
    managedTransaction: ManagedWorkspaceTransaction,
  ): Promise<void> {
    const now = Date.now();
    const isExpired =
      managedTransaction.expiresAt.getTime() <= now ||
      managedTransaction.lastActivityAt.getTime() +
        this.twentyConfigService.get(
          'WORKSPACE_TRANSACTION_SESSION_IDLE_TIMEOUT_MS',
        ) <=
        now;

    if (!isExpired) {
      return;
    }

    await this.expireManagedTransaction(managedTransaction);

    throw this.exception(
      WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED,
      'Transaction session expired',
    );
  }

  private async expireManagedTransaction(
    managedTransaction: ManagedWorkspaceTransaction,
  ): Promise<void> {
    try {
      await managedTransaction.session.expire();
    } catch {
      managedTransaction.state = managedTransaction.session.getState();
    }

    managedTransaction.state = managedTransaction.session.getState();
    this.finalize(managedTransaction);
    this.logger.warn(
      `Workspace transaction ${this.logId(managedTransaction.id)} expired`,
    );
  }

  private assertOwnership(
    managedTransaction:
      | ManagedWorkspaceTransaction
      | TerminalWorkspaceTransaction,
    authContext: WorkspaceAuthContext,
  ): void {
    if (managedTransaction.workspaceId !== authContext.workspace.id) {
      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_WORKSPACE_MISMATCH,
        'Transaction session workspace mismatch',
      );
    }

    if (
      managedTransaction.authType !== authContext.type ||
      managedTransaction.principalKey !==
        buildWorkspaceTransactionPrincipalKey(authContext)
    ) {
      this.logger.warn(
        `Workspace transaction ${this.logId(managedTransaction.id)} principal mismatch`,
      );
      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_FORBIDDEN,
        'Transaction session principal mismatch',
      );
    }
  }

  private assertMetadataVersion(
    managedTransaction: ManagedWorkspaceTransaction,
    metadataVersion: number | undefined,
  ): void {
    if (
      managedTransaction.metadataVersion !== undefined &&
      managedTransaction.metadataVersion !== metadataVersion
    ) {
      throw this.exception(
        WorkspaceTransactionSessionExceptionCode.TRANSACTION_METADATA_CHANGED,
        'Workspace metadata changed during transaction',
      );
    }
  }

  private async ensureMetadataVersion(
    managedTransaction: ManagedWorkspaceTransaction,
    metadataVersion: number | undefined,
  ): Promise<void> {
    try {
      this.assertMetadataVersion(managedTransaction, metadataVersion);
    } catch (error) {
      await this.expireManagedTransaction(managedTransaction);

      throw error;
    }
  }

  private touch(managedTransaction: ManagedWorkspaceTransaction): void {
    managedTransaction.lastActivityAt = new Date();
    managedTransaction.state = managedTransaction.session.getState();
  }

  private finalize(managedTransaction: ManagedWorkspaceTransaction): void {
    managedTransaction.state = managedTransaction.session.getState();

    if (this.sessions.get(managedTransaction.id) === managedTransaction) {
      this.sessions.delete(managedTransaction.id);
    }

    this.terminalSessions.set(managedTransaction.id, {
      id: managedTransaction.id,
      workspaceId: managedTransaction.workspaceId,
      principalKey: managedTransaction.principalKey,
      authType: managedTransaction.authType,
      metadataVersion: managedTransaction.metadataVersion,
      createdAt: managedTransaction.createdAt,
      lastActivityAt: managedTransaction.lastActivityAt,
      expiresAt: managedTransaction.expiresAt,
      state: managedTransaction.state,
      terminalStateExpiresAt: new Date(
        Date.now() + TERMINAL_STATE_CACHE_TTL_MS,
      ),
    });
  }

  private toStatus(
    managedTransaction:
      | ManagedWorkspaceTransaction
      | TerminalWorkspaceTransaction,
  ): WorkspaceTransactionSessionStatus {
    return {
      transactionId: managedTransaction.id,
      state: managedTransaction.state,
      createdAt: managedTransaction.createdAt,
      lastActivityAt: managedTransaction.lastActivityAt,
      expiresAt: managedTransaction.expiresAt,
    };
  }

  private exceptionForState(
    state: WorkspaceTransactionSessionState,
  ): WorkspaceTransactionSessionException {
    switch (state) {
      case 'ABORTED':
        return this.exception(
          WorkspaceTransactionSessionExceptionCode.TRANSACTION_ABORTED,
          'Transaction session is aborted',
        );
      case 'EXPIRED':
        return this.exception(
          WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED,
          'Transaction session expired',
        );
      case 'OPEN':
      case 'COMMITTING':
      case 'COMMITTED':
      case 'ROLLING_BACK':
      case 'ROLLED_BACK':
      case 'FAILED':
        return this.exception(
          WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_OPEN,
          'Transaction session is not open',
        );
    }
  }

  private exception(
    code: keyof typeof WorkspaceTransactionSessionExceptionCode,
    message: string,
  ): WorkspaceTransactionSessionException {
    return new WorkspaceTransactionSessionException(message, code);
  }

  private logId(id: string): string {
    return `${id.slice(0, 12)}…`;
  }
}
