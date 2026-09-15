import { HttpException, Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';
import { ApiPath } from 'twenty-shared/types';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import {
  WorkspaceTransactionSessionException,
  WorkspaceTransactionSessionExceptionCode,
} from 'src/engine/core-modules/workspace-transaction-session/exceptions/workspace-transaction-session.exception';
import { WorkspaceTransactionSessionManager } from 'src/engine/core-modules/workspace-transaction-session/services/workspace-transaction-session-manager.service';

export const WORKSPACE_TRANSACTION_ID_HEADER = 'X-Twenty-Transaction-Id';

@Injectable()
export class WorkspaceTransactionContextMiddleware implements NestMiddleware {
  constructor(
    private readonly workspaceTransactionSessionManager: WorkspaceTransactionSessionManager,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const transactionId = req.get(WORKSPACE_TRANSACTION_ID_HEADER);

    if (
      transactionId === undefined ||
      this.isTransactionControlPath(req.path)
    ) {
      next();

      return;
    }

    try {
      const authContext = getWorkspaceAuthContext();

      void this.workspaceTransactionSessionManager
        .runWithSession(
          transactionId,
          authContext,
          () => this.waitForResponse(res, next),
          req.workspaceMetadataVersion,
        )
        .catch((error: unknown) => {
          if (error instanceof WorkspaceTransactionSessionException) {
            next(this.toHttpException(error));

            return;
          }

          next(error);
        });
    } catch (error) {
      next(error);
    }
  }

  private waitForResponse(
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      response.once('finish', settle);

      try {
        next();
      } catch (error) {
        settled = true;
        reject(error);
      }
    });
  }

  private isTransactionControlPath(path: string): boolean {
    const prefix = `/${ApiPath.Rest}/transaction-sessions`;

    return path === prefix || path.startsWith(`${prefix}/`);
  }

  private toHttpException(
    exception: WorkspaceTransactionSessionException,
  ): HttpException {
    return new HttpException(
      {
        statusCode: this.getStatusCode(exception),
        error: exception.name,
        messages: [exception.message],
        code: exception.code,
      },
      this.getStatusCode(exception),
    );
  }

  private getStatusCode(
    exception: WorkspaceTransactionSessionException,
  ): number {
    switch (exception.code) {
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_FOUND:
        return 404;
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_FORBIDDEN:
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_WORKSPACE_MISMATCH:
        return 403;
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_COMMIT_FAILED:
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_ROLLBACK_FAILED:
        return 500;
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_OPEN:
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_ABORTED:
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED:
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_METADATA_CHANGED:
        return 409;
      case WorkspaceTransactionSessionExceptionCode.TRANSACTION_OPERATION_NOT_SUPPORTED:
        return 400;
    }
  }
}
