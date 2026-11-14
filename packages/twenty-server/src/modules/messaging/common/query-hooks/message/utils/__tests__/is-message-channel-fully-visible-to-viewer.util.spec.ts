import { MessageChannelVisibility } from 'twenty-shared/types';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { isMessageChannelFullyVisibleToViewer } from 'src/modules/messaging/common/query-hooks/message/utils/is-message-channel-fully-visible-to-viewer.util';

describe('isMessageChannelFullyVisibleToViewer @custom', () => {
  it.each([
    [
      MessageChannelVisibility.SHARE_EVERYTHING,
      'system',
      'other',
      'other',
      true,
    ],
    [MessageChannelVisibility.METADATA, 'user', 'viewer', 'other', true],
    [
      MessageChannelVisibility.SUBJECT,
      'application',
      'other',
      'application',
      true,
    ],
    [MessageChannelVisibility.METADATA, 'user', 'other', 'other', false],
    [MessageChannelVisibility.SUBJECT, 'application', 'viewer', 'other', false],
    [
      MessageChannelVisibility.METADATA,
      'system',
      'viewer',
      'application',
      false,
    ],
  ])(
    'checks %s for %s with owners %s/%s',
    (visibility, type, userWorkspaceId, applicationId, expected) => {
      const messageChannel = {
        visibility,
        connectedAccount: { userWorkspaceId, applicationId },
      } as MessageChannelEntity;
      const authContext = {
        type,
        userWorkspaceId: 'viewer',
        application: { id: 'application' },
      } as WorkspaceAuthContext;

      expect(
        isMessageChannelFullyVisibleToViewer({ messageChannel, authContext }),
      ).toBe(expected);
    },
  );
});
