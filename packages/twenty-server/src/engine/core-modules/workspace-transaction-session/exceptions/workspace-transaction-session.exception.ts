import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { assertUnreachable } from 'twenty-shared/utils';

import { STANDARD_ERROR_MESSAGE } from 'src/engine/api/common/common-query-runners/errors/standard-error-message.constant';
import { CustomException } from 'src/utils/custom-exception';

export const WorkspaceTransactionSessionExceptionCode = {
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  TRANSACTION_NOT_OPEN: 'TRANSACTION_NOT_OPEN',
  TRANSACTION_ABORTED: 'TRANSACTION_ABORTED',
  TRANSACTION_EXPIRED: 'TRANSACTION_EXPIRED',
  TRANSACTION_FORBIDDEN: 'TRANSACTION_FORBIDDEN',
  TRANSACTION_WORKSPACE_MISMATCH: 'TRANSACTION_WORKSPACE_MISMATCH',
  TRANSACTION_METADATA_CHANGED: 'TRANSACTION_METADATA_CHANGED',
  TRANSACTION_OPERATION_NOT_SUPPORTED: 'TRANSACTION_OPERATION_NOT_SUPPORTED',
  TRANSACTION_COMMIT_FAILED: 'TRANSACTION_COMMIT_FAILED',
  TRANSACTION_ROLLBACK_FAILED: 'TRANSACTION_ROLLBACK_FAILED',
} as const;

const getUserFriendlyMessage = (
  code: keyof typeof WorkspaceTransactionSessionExceptionCode,
): MessageDescriptor => {
  switch (code) {
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_FOUND:
      return msg`Transaction session not found.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_NOT_OPEN:
      return msg`Transaction session is no longer open.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_ABORTED:
      return msg`Transaction session is aborted. Roll it back before continuing.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_EXPIRED:
      return msg`Transaction session has expired.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_FORBIDDEN:
      return msg`This transaction session belongs to another principal.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_WORKSPACE_MISMATCH:
      return msg`This transaction session belongs to another workspace.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_METADATA_CHANGED:
      return msg`Workspace metadata changed during the transaction.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_OPERATION_NOT_SUPPORTED:
      return msg`This REST operation does not support transaction sessions.`;
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_COMMIT_FAILED:
    case WorkspaceTransactionSessionExceptionCode.TRANSACTION_ROLLBACK_FAILED:
      return STANDARD_ERROR_MESSAGE;
    default:
      assertUnreachable(code);
  }
};

export class WorkspaceTransactionSessionException extends CustomException<
  keyof typeof WorkspaceTransactionSessionExceptionCode
> {
  constructor(
    message: string,
    code: keyof typeof WorkspaceTransactionSessionExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: MessageDescriptor } = {},
  ) {
    super(message, code, {
      userFriendlyMessage: userFriendlyMessage ?? getUserFriendlyMessage(code),
    });
  }
}
