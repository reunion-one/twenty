import { type WorkspaceAuthContextType } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceTransactionSession } from 'src/engine/twenty-orm/datasource/workspace-transaction-session';
import { type WorkspaceTransactionSessionState } from 'src/engine/twenty-orm/types/workspace-transaction-session-state.type';

export type ManagedWorkspaceTransaction = {
  id: string;
  workspaceId: string;
  principalKey: string;
  authType: WorkspaceAuthContextType;
  metadataVersion?: number;
  session: WorkspaceTransactionSession;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  state: WorkspaceTransactionSessionState;
};
