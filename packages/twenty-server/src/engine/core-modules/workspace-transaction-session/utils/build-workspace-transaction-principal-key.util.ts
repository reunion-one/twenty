import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

export const buildWorkspaceTransactionPrincipalKey = (
  authContext: WorkspaceAuthContext,
): string => {
  switch (authContext.type) {
    case 'apiKey':
      return `apiKey:${authContext.apiKey.id}`;
    case 'application':
      return `application:${authContext.application.id}`;
    case 'user':
      return `user:${authContext.userWorkspaceId}:application:${authContext.application?.id ?? authContext.viaApplication?.id ?? 'direct'}`;
    case 'pendingActivationUser':
      return `pendingActivationUser:${authContext.userWorkspaceId}`;
    case 'system':
      return 'system';
  }
};
