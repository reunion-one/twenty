import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';

import { type Response } from 'express';

import { HttpExceptionHandlerService } from 'src/engine/core-modules/exception-handler/http-exception-handler.service';
import {
  WorkspaceTransactionSessionException,
  WorkspaceTransactionSessionExceptionCode,
} from 'src/engine/core-modules/workspace-transaction-session/exceptions/workspace-transaction-session.exception';

@Catch()
export class WorkspaceTransactionSessionRestApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpExceptionHandlerService: HttpExceptionHandlerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof WorkspaceTransactionSessionException)) {
      const normalizedException =
        exception instanceof HttpException || exception instanceof Error
          ? exception
          : new Error(String(exception));

      return this.httpExceptionHandlerService.handleError(
        normalizedException,
        response,
        exception instanceof HttpException ? exception.getStatus() : 500,
      );
    }

    return this.httpExceptionHandlerService.handleError(
      exception,
      response,
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
