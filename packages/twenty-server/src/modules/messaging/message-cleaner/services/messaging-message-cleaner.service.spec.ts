import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { ParticipantTargetReconciliationService } from 'src/modules/match-participant/participant-target-reconciliation.service';
import { MessagingMessageCleanerService } from 'src/modules/messaging/message-cleaner/services/messaging-message-cleaner.service';

describe('MessagingMessageCleanerService orphan messages @custom', () => {
  it('deletes an orphan Message and its thread, including its raw payload', async () => {
    const messageId = 'orphan-message-id';
    const threadId = 'orphan-thread-id';
    const messageRepository = {
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: messageId,
            messageThreadId: threadId,
            rawProviderData: { providerMessageId: 'orphan-provider-message' },
          },
        ])
        .mockResolvedValueOnce([]),
      delete: jest.fn(),
    };
    const messageChannelMessageAssociationRepository = {
      find: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'association-id', messageId }])
        .mockResolvedValueOnce([]),
      delete: jest.fn(),
    };
    const messageThreadRepository = { delete: jest.fn() };
    const repositories = {
      message: messageRepository,
      messageChannelMessageAssociation:
        messageChannelMessageAssociationRepository,
      messageThread: messageThreadRepository,
    };
    const transactionScope = {
      getRepository: jest.fn(
        (objectMetadataName: keyof typeof repositories) =>
          repositories[objectMetadataName],
      ),
    } as unknown as WorkspaceTransactionScope;
    const workspaceOrmManager = {
      executeInWorkspaceContext: jest.fn(
        async (callback: () => Promise<void>) => callback(),
      ),
      runInWorkspaceTransaction: jest.fn(
        async (callback: (scope: WorkspaceTransactionScope) => Promise<void>) =>
          callback(transactionScope),
      ),
    } as unknown as WorkspaceOrmManager;
    const participantTargetReconciliationService = {
      reconcileMessageThreadTargets: jest.fn(),
    } as unknown as ParticipantTargetReconciliationService;
    const service = new MessagingMessageCleanerService(
      workspaceOrmManager,
      participantTargetReconciliationService,
    );

    await service.deleteMessagesChannelMessageAssociationsAndRelatedOrphans({
      workspaceId: 'workspace-id',
      messageExternalIds: ['orphan-provider-message'],
      messageChannelId: 'message-channel-id',
    });

    expect(messageRepository.delete).toHaveBeenCalledWith([messageId]);
    expect(messageThreadRepository.delete).toHaveBeenCalledWith([threadId]);
  });
});
