export type WorkspaceTransactionSessionState =
  | 'OPEN'
  | 'ABORTED'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'EXPIRED'
  | 'FAILED';
