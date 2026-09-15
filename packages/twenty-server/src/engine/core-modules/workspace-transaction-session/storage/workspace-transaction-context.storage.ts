import { AsyncLocalStorage } from 'async_hooks';

import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';

export const workspaceTransactionContextStorage =
  new AsyncLocalStorage<WorkspaceTransactionScope>();

export const getWorkspaceTransactionScope = (): WorkspaceTransactionScope => {
  const scope = workspaceTransactionContextStorage.getStore();

  if (!scope) {
    throw new Error(
      'Workspace transaction scope not set. Operations must be wrapped with withWorkspaceTransactionScope()',
    );
  }

  return scope;
};

export const getWorkspaceTransactionScopeOrUndefined = ():
  | WorkspaceTransactionScope
  | undefined => workspaceTransactionContextStorage.getStore();

export const withWorkspaceTransactionScope = <T>(
  scope: WorkspaceTransactionScope,
  fn: () => T | Promise<T>,
): T | Promise<T> => workspaceTransactionContextStorage.run(scope, fn);
