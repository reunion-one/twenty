import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';
import { MessagingMessageService } from 'src/modules/messaging/message-import-manager/services/messaging-message.service';

const MESSAGE_CHANNEL_ID = 'message-channel-id';

const buildMessage = (
  overrides: Partial<MessageWithParticipants> = {},
): MessageWithParticipants =>
  ({
    externalId: 'provider-message-1',
    headerMessageId: '<provider-message-1@example.com>',
    subject: 'Incoming subject',
    text: 'Incoming body',
    receivedAt: new Date('2026-10-01T10:00:00.000Z'),
    messageThreadExternalId: 'provider-thread-1',
    direction: MessageDirection.INCOMING,
    participants: [],
    attachments: [],
    isDraft: false,
    ...overrides,
  }) as MessageWithParticipants;

const buildExistingMessage = (
  overrides: Partial<MessageWorkspaceEntity> = {},
): MessageWorkspaceEntity =>
  ({
    id: 'message-id',
    headerMessageId: '<provider-message-1@example.com>',
    messageThreadId: 'message-thread-id',
    subject: 'Original subject',
    text: 'Original body',
    receivedAt: new Date('2026-09-01T10:00:00.000Z'),
    isDraft: false,
    rawProviderData: { providerMessageId: 'original' },
    ...overrides,
  }) as MessageWorkspaceEntity;

const buildService = (
  existingMessages: MessageWorkspaceEntity[],
  existingAssociations: { id: string; messageId: string }[] = [
    { id: 'association-id', messageId: 'message-id' },
  ],
) => {
  const messageRepository = {
    find: jest.fn().mockResolvedValue(existingMessages),
    insert: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue(undefined),
  };
  const associationRepository = {
    find: jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(existingAssociations),
    insert: jest.fn().mockResolvedValue(undefined),
  };
  const messageThreadRepository = {
    insert: jest.fn().mockResolvedValue(undefined),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const repositories = {
    message: messageRepository,
    messageChannelMessageAssociation: associationRepository,
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
      async (callback: () => Promise<unknown>) => callback(),
    ),
  } as unknown as WorkspaceOrmManager;

  return {
    service: new MessagingMessageService(workspaceOrmManager),
    messageRepository,
    transactionScope,
  };
};

describe('MessagingMessageService raw provider data @custom', () => {
  it('updates raw data while retaining large payloads', async () => {
    const { service, messageRepository, transactionScope } = buildService([
      buildExistingMessage(),
    ]);
    const largePayload = 'a'.repeat(256 * 1024);

    await service.saveMessagesWithinTransaction(
      [buildMessage({ rawProviderData: { largePayload } })],
      MESSAGE_CHANNEL_ID,
      transactionScope,
      'workspace-id',
    );

    expect(messageRepository.updateMany).toHaveBeenCalledTimes(1);
    const [updates] = messageRepository.updateMany.mock.calls[0];

    expect(updates).toHaveLength(1);
    expect(updates[0].criteria).toBe('message-id');
    expect(updates[0].partialEntity).toEqual({
      rawProviderData: { largePayload },
    });
    expect(messageRepository.insert).toHaveBeenCalledWith([]);
  });

  it('skips updates when the raw data is unchanged', async () => {
    const rawProviderData = { providerMessageId: 'original' };
    const { service, messageRepository, transactionScope } = buildService([
      buildExistingMessage({ rawProviderData }),
    ]);

    await service.saveMessagesWithinTransaction(
      [buildMessage({ rawProviderData })],
      MESSAGE_CHANNEL_ID,
      transactionScope,
      'workspace-id',
    );

    expect(messageRepository.updateMany).not.toHaveBeenCalled();
  });

  it('preserves raw data when the provider omits it or passes null', async () => {
    for (const rawProviderData of [undefined, null]) {
      const { service, messageRepository, transactionScope } = buildService([
        buildExistingMessage(),
      ]);

      await service.saveMessagesWithinTransaction(
        [buildMessage({ rawProviderData })],
        MESSAGE_CHANNEL_ID,
        transactionScope,
        'workspace-id',
      );

      expect(messageRepository.updateMany).not.toHaveBeenCalled();
    }
  });

  it('replaces raw data in one update', async () => {
    const { service, messageRepository, transactionScope } = buildService([
      buildExistingMessage(),
    ]);
    const newMessageChannelId = 'replacement-message-channel-id';
    const rawProviderData = { providerMessageId: 'replacement' };

    await service.saveMessagesWithinTransaction(
      [buildMessage({ rawProviderData })],
      newMessageChannelId,
      transactionScope,
      'workspace-id',
    );

    expect(messageRepository.updateMany).toHaveBeenCalledWith([
      {
        criteria: 'message-id',
        partialEntity: {
          rawProviderData,
        },
      },
    ]);
  });

  it('stores empty raw objects on new messages', async () => {
    const { service, messageRepository, transactionScope } = buildService(
      [],
      [],
    );

    await service.saveMessagesWithinTransaction(
      [buildMessage({ rawProviderData: {} })],
      MESSAGE_CHANNEL_ID,
      transactionScope,
      'workspace-id',
    );

    expect(messageRepository.insert).toHaveBeenCalledTimes(1);
    const [[message]] = messageRepository.insert.mock.calls[0];

    expect(message).toMatchObject({
      rawProviderData: {},
    });
  });

  it('creates messages from legacy providers without raw fields when omitted', async () => {
    const { service, messageRepository, transactionScope } = buildService(
      [],
      [],
    );

    await service.saveMessagesWithinTransaction(
      [buildMessage()],
      MESSAGE_CHANNEL_ID,
      transactionScope,
      'workspace-id',
    );

    const [[message]] = messageRepository.insert.mock.calls[0];

    expect(message).not.toHaveProperty('rawProviderData');
  });
});
