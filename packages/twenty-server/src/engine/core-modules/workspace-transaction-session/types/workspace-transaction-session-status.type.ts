import { type WorkspaceTransactionSessionState } from 'src/engine/twenty-orm/types/workspace-transaction-session-state.type';

export type WorkspaceTransactionSessionStatus = {
  transactionId: string;
  state: WorkspaceTransactionSessionState;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
};
