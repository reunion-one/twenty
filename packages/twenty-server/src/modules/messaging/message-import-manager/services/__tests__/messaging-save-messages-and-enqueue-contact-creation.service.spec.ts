import { Test } from '@nestjs/testing';
import { MessageChannelType } from 'twenty-shared/types';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { getQueueToken } from 'src/engine/core-modules/message-queue/utils/get-queue-token.util';
import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { type MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { MessagingMessageAttachmentService } from 'src/modules/messaging/message-import-manager/services/messaging-message-attachment.service';
import { MessagingMessageFolderAssociationService } from 'src/modules/messaging/message-import-manager/services/messaging-message-folder-association.service';
import { MessagingMessageRawContentService } from 'src/modules/messaging/message-import-manager/services/messaging-message-raw-content.service';
import { MessagingMessageService } from 'src/modules/messaging/message-import-manager/services/messaging-message.service';
import { MessagingSaveMessagesAndEnqueueContactCreationService } from 'src/modules/messaging/message-import-manager/services/messaging-save-messages-and-enqueue-contact-creation.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';
import { MessagingMessageParticipantService } from 'src/modules/messaging/message-participant-manager/services/messaging-message-participant.service';

describe('MessagingSaveMessagesAndEnqueueContactCreationService raw content @custom', () => {
  const transactionScope = {
    workspaceId: 'workspace-1',
  } as WorkspaceTransactionScope;
  const messageExternalIdsAndIdsMap = new Map([['external-1', 'message-1']]);
  const associationIds = new Map([['external-1', 'association-1']]);
  const messages: MessageWithParticipants[] = [];
  const calls: string[] = [];
  const saveMessageRawContents = jest.fn();
  const matchMessageParticipants = jest.fn();
  const executeTransactionInWorkspaceContext = jest.fn(
    async (callback: (scope: WorkspaceTransactionScope) => Promise<unknown>) =>
      callback(transactionScope),
  );
  let service: MessagingSaveMessagesAndEnqueueContactCreationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    calls.length = 0;
    saveMessageRawContents.mockImplementation(async () => {
      calls.push('raw');
    });
    const module = await Test.createTestingModule({
      providers: [
        MessagingSaveMessagesAndEnqueueContactCreationService,
        {
          provide: getQueueToken(MessageQueue.contactCreationQueue),
          useValue: { add: jest.fn() },
        },
        {
          provide: WorkspaceOrmManager,
          useValue: { executeTransactionInWorkspaceContext },
        },
        {
          provide: MessagingMessageService,
          useValue: {
            saveMessagesWithinTransaction: jest.fn().mockResolvedValue({
              messageExternalIdsAndIdsMap,
              messageExternalIdToMessageChannelMessageAssociationIdMap:
                associationIds,
              messageExternalIdToMessageThreadIdMap: new Map(),
              refetchedMessageChannelMessageAssociationIds: [],
              sentDraftMessageIds: [],
            }),
          },
        },
        {
          provide: MessagingMessageParticipantService,
          useValue: {
            saveMessageParticipants: jest.fn().mockResolvedValue([]),
            matchMessageParticipants,
          },
        },
        {
          provide: MessagingMessageFolderAssociationService,
          useValue: {
            saveMessageFolderAssociations: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MessagingMessageAttachmentService,
          useValue: {
            saveMessageAttachments: jest.fn(),
            saveMessageRemoteAttachments: jest.fn(
              async ({
                transactionScope: scope,
              }: {
                transactionScope: WorkspaceTransactionScope;
              }) => {
                expect(scope).toBe(transactionScope);
                await Promise.resolve();
                calls.push('remote');
              },
            ),
          },
        },
        {
          provide: MessagingMessageRawContentService,
          useValue: { saveMessageRawContents },
        },
      ],
    }).compile();
    service = module.get(MessagingSaveMessagesAndEnqueueContactCreationService);
  });

  const save = () =>
    service.saveMessagesAndEnqueueContactCreation({
      messagesToSave: messages,
      messageChannel: {
        id: 'channel-1',
        type: MessageChannelType.EMAIL,
        isContactAutoCreationEnabled: false,
      } as MessageChannelEntity,
      connectedAccount: {
        handle: 'sender@example.com',
        handleAliases: [],
      } as unknown as ConnectedAccountEntity,
      workspaceId: 'workspace-1',
      folderLinkUpdate: 'replace',
    });

  it('saves raw content immediately after remote attachments with both maps in the same transaction', async () => {
    await save();

    expect(calls).toEqual(['remote', 'raw']);
    expect(saveMessageRawContents).toHaveBeenCalledWith({
      messages,
      messageExternalIdsAndIdsMap,
      messageExternalIdToMessageChannelMessageAssociationIdMap: associationIds,
      transactionScope,
    });
    expect(executeTransactionInWorkspaceContext).toHaveBeenCalledTimes(1);
  });

  it('propagates raw-content failure out of the transaction before post-save work', async () => {
    saveMessageRawContents.mockRejectedValueOnce(new Error('raw write failed'));

    await expect(save()).rejects.toThrow('raw write failed');
    expect(matchMessageParticipants).not.toHaveBeenCalled();
  });
});
