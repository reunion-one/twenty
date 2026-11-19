import { MessageChannelVisibility } from 'twenty-shared/types';

import { isApplicationAuthContext } from 'src/engine/core-modules/auth/guards/is-application-auth-context.guard';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';

export const isMessageChannelFullyVisibleToViewer = ({
  messageChannel,
  authContext,
}: {
  messageChannel: MessageChannelEntity;
  authContext: WorkspaceAuthContext;
}): boolean => {
  if (messageChannel.visibility === MessageChannelVisibility.SHARE_EVERYTHING) {
    return true;
  }

  if (isUserAuthContext(authContext)) {
    return (
      messageChannel.connectedAccount.userWorkspaceId ===
      authContext.userWorkspaceId
    );
  }

  // Email connections carry no applicationId, so an application only sees through channels it created itself
  if (isApplicationAuthContext(authContext)) {
    return (
      messageChannel.connectedAccount.applicationId ===
      authContext.application.id
    );
  }

  return false;
};
