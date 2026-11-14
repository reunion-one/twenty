import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { type MessageRawContentWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-raw-content.workspace-entity';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { MessagingMessageService } from 'src/modules/messaging/message-import-manager/services/messaging-message.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';

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
    ...overrides,
  }) as MessageWorkspaceEntity;

const RAW_CONTENT = {
  provider: 'gmail',
  contentFormat: 'gmail-snapshot-v1',
  content: 'raw body',
  metadata: { labels: ['INBOX'] },
};

const buildService = (
  existingMessages: MessageWorkspaceEntity[],
  existingAssociations: { id: string; messageId: string }[] = [
    { id: 'association-id', messageId: 'message-id' },
  ],
  existingRawContents: Partial<MessageRawContentWorkspaceEntity>[] = [],
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
  const rawContentRepository = {
    find: jest.fn().mockResolvedValue(existingRawContents),
    insert: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue(undefined),
  };
  const repositories = {
    messageRawContent: rawContentRepository,
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
    associationRepository,
    rawContentRepository,
    transactionScope,
  };
};

describe('MessagingMessageService raw content @custom', () => {
  const saveMessages = (
    harness: ReturnType<typeof buildService>,
    messages = [buildMessage({ rawContent: RAW_CONTENT })],
  ) =>
    harness.service.saveMessagesWithinTransaction(
      messages,
      MESSAGE_CHANNEL_ID,
      harness.transactionScope,
      'workspace-id',
    );

  const existingRawContent = {
    id: 'raw-content-id',
    messageId: 'message-id',
    messageChannelMessageAssociationId: 'association-id',
    provider: RAW_CONTENT.provider,
    contentFormat: RAW_CONTENT.contentFormat,
    rawContent: RAW_CONTENT.content,
    metadata: RAW_CONTENT.metadata,
  };

  it('inserts raw content linked to the created message and association', async () => {
    const harness = buildService([], []);
    const result = await saveMessages(harness);
    const messageId = result.createdMessages[0].id;
    const associationId =
      result.messageExternalIdToMessageChannelMessageAssociationIdMap.get(
        'provider-message-1',
      );

    expect(harness.rawContentRepository.insert).toHaveBeenCalledWith([
      {
        ...existingRawContent,
        id: expect.any(String),
        messageId,
        messageChannelMessageAssociationId: associationId,
      },
    ]);
    expect(harness.rawContentRepository.updateMany).not.toHaveBeenCalled();
  });

  it('links raw content to an existing message and a new channel association', async () => {
    const harness = buildService([buildExistingMessage()], []);
    const result = await saveMessages(harness);

    expect(harness.rawContentRepository.insert).toHaveBeenCalledWith([
      {
        ...existingRawContent,
        id: expect.any(String),
        messageChannelMessageAssociationId:
          result.messageExternalIdToMessageChannelMessageAssociationIdMap.get(
            'provider-message-1',
          ),
      },
    ]);
    expect(harness.messageRepository.insert).toHaveBeenCalledWith([]);
    expect(harness.associationRepository.insert).toHaveBeenCalledWith([
      expect.objectContaining({ messageId: 'message-id' }),
    ]);
  });

  it('does not insert or update identical raw content', async () => {
    const harness = buildService([buildExistingMessage()], undefined, [
      existingRawContent,
    ]);

    await saveMessages(harness, [
      buildMessage({
        rawContent: { ...RAW_CONTENT, metadata: { labels: ['INBOX'] } },
      }),
    ]);

    expect(harness.rawContentRepository.insert).not.toHaveBeenCalled();
    expect(harness.rawContentRepository.updateMany).not.toHaveBeenCalled();
  });

  it('updates changed raw content in place with the latest envelope', async () => {
    const harness = buildService([buildExistingMessage()], undefined, [
      existingRawContent,
    ]);

    await saveMessages(harness, [
      buildMessage({
        rawContent: { ...RAW_CONTENT, content: 'new body', metadata: null },
      }),
    ]);

    expect(harness.rawContentRepository.insert).not.toHaveBeenCalled();
    expect(harness.rawContentRepository.updateMany).toHaveBeenCalledWith([
      {
        criteria: 'raw-content-id',
        partialEntity: {
          messageId: 'message-id',
          messageChannelMessageAssociationId: 'association-id',
          provider: RAW_CONTENT.provider,
          contentFormat: RAW_CONTENT.contentFormat,
          rawContent: 'new body',
          metadata: null,
        },
      },
    ]);
  });

  it('never accesses the raw content repository when raw content is absent', async () => {
    const harness = buildService([], []);

    await saveMessages(harness, [buildMessage()]);

    expect(harness.transactionScope.getRepository).not.toHaveBeenCalledWith(
      'messageRawContent',
      expect.anything(),
    );
    expect(harness.rawContentRepository.find).not.toHaveBeenCalled();
    expect(harness.rawContentRepository.insert).not.toHaveBeenCalled();
    expect(harness.rawContentRepository.updateMany).not.toHaveBeenCalled();
  });

  it('writes only the raw content supplied in a mixed batch', async () => {
    const harness = buildService([], []);

    await saveMessages(harness, [
      buildMessage({ rawContent: RAW_CONTENT }),
      buildMessage({
        externalId: 'provider-message-2',
        headerMessageId: '<second@example.com>',
      }),
    ]);

    expect(harness.rawContentRepository.insert).toHaveBeenCalledTimes(1);
    expect(harness.rawContentRepository.insert.mock.calls[0][0]).toHaveLength(
      1,
    );
  });
});
