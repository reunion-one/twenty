import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { FeatureFlagKey } from 'twenty-shared/types';
import { In } from 'typeorm';

import { type FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { type FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type MessageRawContentAttachment } from 'src/modules/messaging/common/types/message-raw-content-attachment.type';
import { type MessageRawContentWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-raw-content.workspace-entity';
import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';
import { MessagingMessageRawContentService } from 'src/modules/messaging/message-import-manager/services/messaging-message-raw-content.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';

type StoredRow = Pick<
  MessageRawContentWorkspaceEntity,
  | 'id'
  | 'messageId'
  | 'messageChannelMessageAssociationId'
  | 'provider'
  | 'contentFormat'
  | 'rawContent'
  | 'metadata'
  | 'twentyAttachments'
>;
type StoredAttachment = Pick<
  AttachmentWorkspaceEntity,
  'id' | 'targetMessageId' | 'file'
>;
type StoredFile = Pick<FileEntity, 'id' | 'size' | 'remoteOrigin'>;

const rawContent = {
  provider: 'gmail',
  contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
  content: 'original bytes',
  metadata: null,
};
const buildMessage = (
  overrides: Partial<MessageWithParticipants> = {},
): MessageWithParticipants => ({
  externalId: 'external-1',
  headerMessageId: '<message@example.com>',
  messageThreadExternalId: 'thread-1',
  receivedAt: new Date(0),
  subject: 'Hello',
  text: 'Hello',
  direction: MessageDirection.INCOMING,
  participants: [],
  attachments: [],
  isDraft: false,
  rawContent,
  ...overrides,
});
const buildStoredRow = (overrides: Partial<StoredRow> = {}): StoredRow => ({
  id: 'raw-1',
  messageId: 'message-1',
  messageChannelMessageAssociationId: 'association-1',
  provider: rawContent.provider,
  contentFormat: rawContent.contentFormat,
  rawContent: rawContent.content,
  metadata: null,
  twentyAttachments: [],
  ...overrides,
});
const part = (partId: string, overrides: Record<string, unknown> = {}) => ({
  part_path: partId,
  mime_part_id: partId,
  content_type: 'application/pdf',
  filename: 'report.pdf',
  size_bytes: 10,
  externalized: true,
  ...overrides,
  provider_locator: { provider: 'gmail', attachment_id: `gmail-${partId}` },
});
const snapshotContent = (parts: Record<string, unknown>[]) =>
  JSON.stringify({
    schema: 'email-semantic-snapshot',
    schema_version: 1,
    mime: { parts },
  });
const attachment = (
  id: string,
  fileId: string,
  messageId = 'message-1',
): StoredAttachment => ({
  id,
  targetMessageId: messageId,
  file: [{ fileId, label: 'report.pdf', extension: 'pdf' }],
});
const remoteFile = (
  id: string,
  partId: string,
  associationId = 'association-1',
): StoredFile => ({
  id,
  size: 10,
  remoteOrigin: {
    originType: 'MESSAGE',
    originId: associationId,
    originKey: partId,
  },
});

describe('MessagingMessageRawContentService @custom', () => {
  const findRawContents = jest.fn<Promise<StoredRow[]>, [unknown]>();
  const insert = jest.fn<Promise<void>, [StoredRow[]]>();
  const updateMany = jest.fn<
    Promise<void>,
    [{ criteria: string; partialEntity: Omit<StoredRow, 'id'> }[]]
  >();
  const findAttachments = jest.fn<Promise<StoredAttachment[]>, [unknown]>();
  const findFiles = jest.fn<Promise<StoredFile[]>, [string, unknown]>();
  const isFeatureEnabled = jest.fn();
  const getRepositoryWithoutPermissionChecks = jest.fn((name: string) => {
    if (name === 'messageRawContent') {
      return { find: findRawContents, insert, updateMany };
    }
    if (name === 'attachment') {
      return { find: findAttachments };
    }
    throw new Error(`Unexpected repository ${name}`);
  });
  const transactionScope = {
    workspaceId: 'workspace-1',
    getRepositoryWithoutPermissionChecks,
  } as unknown as WorkspaceTransactionScope;
  const service = new MessagingMessageRawContentService(
    { find: findFiles } as unknown as WorkspaceScopedRepository<FileEntity>,
    { isFeatureEnabled } as unknown as FeatureFlagService,
  );
  const save = (
    messages = [buildMessage()],
    messageExternalIdsAndIdsMap = new Map([['external-1', 'message-1']]),
    messageExternalIdToMessageChannelMessageAssociationIdMap = new Map([
      ['external-1', 'association-1'],
    ]),
  ) =>
    service.saveMessageRawContents({
      messages,
      messageExternalIdsAndIdsMap,
      messageExternalIdToMessageChannelMessageAssociationIdMap,
      transactionScope,
    });
  const saveSnapshot = (
    content: string,
    messageOverrides: Partial<MessageWithParticipants> = {},
  ) =>
    save([
      buildMessage({
        ...messageOverrides,
        rawContent: { ...rawContent, content },
      }),
    ]);
  const insertedMappings = (): MessageRawContentAttachment[] =>
    insert.mock.calls[0][0][0].twentyAttachments!;

  beforeEach(() => {
    jest.clearAllMocks();
    findRawContents.mockResolvedValue([]);
    insert.mockResolvedValue(undefined);
    updateMany.mockResolvedValue(undefined);
    findAttachments.mockResolvedValue([]);
    findFiles.mockResolvedValue([]);
    isFeatureEnabled.mockResolvedValue(false);
  });

  it.each(['no raw content', 'no message id', 'no association id'])(
    'does no repository or flag work with %s',
    async (missing) => {
      await save(
        [
          buildMessage(
            missing === 'no raw content' ? { rawContent: undefined } : {},
          ),
        ],
        missing === 'no message id' ? new Map() : undefined,
        missing === 'no association id' ? new Map() : undefined,
      );

      expect(getRepositoryWithoutPermissionChecks).not.toHaveBeenCalled();
      expect(findFiles).not.toHaveBeenCalled();
      expect(isFeatureEnabled).not.toHaveBeenCalled();
    },
  );

  it('inserts the latest raw input per association without mutating messages', async () => {
    const first = buildMessage();
    const last = buildMessage({
      rawContent: { ...rawContent, content: 'latest bytes' },
    });

    await save([first, last]);

    expect(findRawContents).toHaveBeenCalledWith({
      where: { messageChannelMessageAssociationId: In(['association-1']) },
    });
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        ...buildStoredRow(),
        id: expect.any(String),
        rawContent: 'latest bytes',
      }),
    ]);
    expect(updateMany).not.toHaveBeenCalled();
    expect(first.rawContent?.content).toBe('original bytes');
    expect(last.rawContent?.content).toBe('latest bytes');
  });

  it('does not rewrite identical content or differently ordered equal metadata', async () => {
    findRawContents.mockResolvedValue([
      buildStoredRow({ metadata: { first: 1, second: [2] } }),
    ]);

    await save([
      buildMessage({
        rawContent: { ...rawContent, metadata: { second: [2], first: 1 } },
      }),
    ]);

    expect(insert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each([
    'messageId',
    'provider',
    'contentFormat',
    'rawContent',
    'metadata',
  ] as const)('updates changed %s on the existing row', async (field) => {
    findRawContents.mockResolvedValue([
      buildStoredRow({
        [field]: field === 'metadata' ? { old: true } : 'old',
      }),
    ]);

    await save();

    expect(insert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith([
      {
        criteria: 'raw-1',
        partialEntity: {
          messageId: 'message-1',
          messageChannelMessageAssociationId: 'association-1',
          provider: 'gmail',
          contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
          rawContent: 'original bytes',
          metadata: null,
          twentyAttachments: [],
        },
      },
    ]);
  });

  it('chunks changed rows at the repository update limit', async () => {
    const messages = Array.from({ length: QUERY_MAX_RECORDS + 1 }, (_, index) =>
      buildMessage({ externalId: `external-${index}` }),
    );
    const messageIds = new Map(
      messages.map(({ externalId }, index) => [externalId, `message-${index}`]),
    );
    const associationIds = new Map(
      messages.map(({ externalId }, index) => [
        externalId,
        `association-${index}`,
      ]),
    );

    findRawContents.mockResolvedValue(
      messages.map((_, index) =>
        buildStoredRow({
          id: `raw-${index}`,
          messageId: `message-${index}`,
          messageChannelMessageAssociationId: `association-${index}`,
          rawContent: 'old',
        }),
      ),
    );
    await save(messages, messageIds, associationIds);

    expect(updateMany.mock.calls.map(([updates]) => updates.length)).toEqual([
      QUERY_MAX_RECORDS,
      1,
    ]);
  });

  it('stores an association mapping separately and preserves matched snapshot bytes', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([attachment('attachment-1', 'file-1')]);
    findFiles.mockResolvedValue([remoteFile('file-1', '2')]);
    const content = `  ${snapshotContent([part('2', { part_path: 'root' })])}\n`;
    const metadata = Object.freeze({ correlationId: 'provider-correlation' });
    const message = buildMessage({
      rawContent: { ...rawContent, content, metadata },
    });

    await save([message]);

    expect(insertedMappings()).toEqual([
      {
        partPath: 'root',
        mimePartId: '2',
        attachmentId: 'attachment-1',
        fileId: 'file-1',
        match: 'association',
      },
    ]);
    expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
    expect(insert.mock.calls[0][0][0].metadata).toEqual({
      correlationId: 'provider-correlation',
    });
    expect(message.rawContent?.content).toBe(content);
    expect(isFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlagKey.IS_MESSAGE_ATTACHMENT_ENABLED,
      'workspace-1',
    );
    expect(findAttachments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { targetMessageId: In(['message-1']) },
      }),
    );
    expect(findFiles).toHaveBeenCalledWith('workspace-1', {
      where: { id: In(['file-1']) },
      select: { id: true, size: true, remoteOrigin: true },
    });
  });

  it('prefers its own association and never falls back across messages', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([
      attachment('attachment-other', 'file-other'),
      attachment('attachment-own', 'file-own'),
      attachment('attachment-foreign', 'file-foreign', 'different-message'),
    ]);
    findFiles.mockResolvedValue([
      remoteFile('file-other', '2', 'other-association'),
      remoteFile('file-own', '2'),
      remoteFile('file-foreign', '3'),
    ]);
    await saveSnapshot(snapshotContent([part('2'), part('3')]));

    expect(insertedMappings()).toEqual([
      expect.objectContaining({
        partPath: '2',
        fileId: 'file-own',
        match: 'association',
      }),
    ]);

    insert.mockClear();
    findAttachments.mockResolvedValue([
      attachment('attachment-other', 'file-other'),
    ]);
    await saveSnapshot(snapshotContent([part('2')]));

    expect(insertedMappings()).toEqual([
      expect.objectContaining({
        partPath: '2',
        fileId: 'file-other',
        match: 'message',
      }),
    ]);
  });

  it('uses nearest opaque ancestors with exact-match and dotted-boundary precedence', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([
      attachment('attachment-a', 'file-a'),
      attachment('attachment-b', 'file-b'),
      attachment('attachment-c', 'file-c'),
      attachment('attachment-d', 'file-d'),
    ]);
    findFiles.mockResolvedValue([
      remoteFile('file-a', '2.1'),
      remoteFile('file-b', '2.2'),
      remoteFile('file-c', '20.1'),
      remoteFile('file-d', '2.3.1'),
    ]);
    const content = snapshotContent([
      part('2', { part_path: '0', content_type: 'message/rfc822' }),
      part('2.1', { part_path: '1' }),
      part('2.3', { part_path: '2', content_type: 'message/rfc822' }),
    ]);
    await saveSnapshot(content);

    expect(insertedMappings()).toEqual([
      {
        partPath: '0',
        mimePartId: '2.2',
        attachmentId: 'attachment-b',
        fileId: 'file-b',
        match: 'ancestor',
      },
      {
        partPath: '1',
        mimePartId: '2.1',
        attachmentId: 'attachment-a',
        fileId: 'file-a',
        match: 'association',
      },
      {
        partPath: '2',
        mimePartId: '2.3.1',
        attachmentId: 'attachment-d',
        fileId: 'file-d',
        match: 'ancestor',
      },
    ]);
    expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
  });

  it('maps descendants of an opaque root to root without traversing its children', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([attachment('attachment-1', 'file-1')]);
    findFiles.mockResolvedValue([remoteFile('file-1', '2.1')]);
    const content = JSON.stringify({
      schema: 'email-semantic-snapshot',
      schema_version: 1,
      mime: part('2', {
        part_path: 'root',
        content_type: 'message/rfc822',
        parts: [part('2.1')],
      }),
    });

    await saveSnapshot(content);

    expect(insertedMappings()).toEqual([
      {
        partPath: 'root',
        mimePartId: '2.1',
        attachmentId: 'attachment-1',
        fileId: 'file-1',
        match: 'ancestor',
      },
    ]);
    expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
  });

  it('keeps multiple child mappings stable and clears stale entries on re-import', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const attachments = [
      attachment('attachment-b', 'file-b'),
      attachment('attachment-a', 'file-a'),
    ];
    findAttachments.mockResolvedValue(attachments);
    findFiles.mockResolvedValue([
      remoteFile('file-b', '2.2'),
      remoteFile('file-a', '2.1'),
    ]);
    const content = snapshotContent([
      part('2', { part_path: '0', content_type: 'message/rfc822' }),
    ]);

    await saveSnapshot(content);
    const stored = insert.mock.calls[0][0][0];

    expect(stored.twentyAttachments).toEqual([
      expect.objectContaining({
        partPath: '0',
        mimePartId: '2.1',
        match: 'ancestor',
      }),
      expect.objectContaining({
        partPath: '0',
        mimePartId: '2.2',
        match: 'ancestor',
      }),
    ]);
    findRawContents.mockResolvedValue([stored]);
    findAttachments.mockResolvedValue([...attachments].reverse());
    insert.mockClear();
    await saveSnapshot(content);

    expect(insert).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();

    findAttachments.mockResolvedValue([]);
    await saveSnapshot(content);
    expect(updateMany).toHaveBeenCalledWith([
      {
        criteria: stored.id,
        partialEntity: expect.objectContaining({
          rawContent: content,
          twentyAttachments: [],
        }),
      },
    ]);
  });

  it('updates a mapping-only change with the original raw content and independent metadata', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const content = snapshotContent([part('2')]);
    findRawContents.mockResolvedValue([
      buildStoredRow({ rawContent: content }),
    ]);
    findAttachments.mockResolvedValue([
      attachment('attachment-new', 'file-new'),
    ]);
    findFiles.mockResolvedValue([remoteFile('file-new', '2')]);

    await saveSnapshot(content);

    expect(insert).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith([
      {
        criteria: 'raw-1',
        partialEntity: expect.objectContaining({
          rawContent: content,
          metadata: null,
          twentyAttachments: [
            {
              partPath: '2',
              mimePartId: '2',
              attachmentId: 'attachment-new',
              fileId: 'file-new',
              match: 'association',
            },
          ],
        }),
      },
    ]);
  });

  it('compares mapping entries deeply regardless of their object key order', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    const content = snapshotContent([part('2')]);
    findRawContents.mockResolvedValue([
      buildStoredRow({
        rawContent: content,
        twentyAttachments: [
          {
            match: 'association',
            fileId: 'file-1',
            attachmentId: 'attachment-1',
            mimePartId: '2',
            partPath: '2',
          },
        ],
      }),
    ]);
    findAttachments.mockResolvedValue([attachment('attachment-1', 'file-1')]);
    findFiles.mockResolvedValue([remoteFile('file-1', '2')]);

    await saveSnapshot(content);
    expect(updateMany).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(['no attachments', 'unmatched part'])(
    'stores [] and preserves original bytes with %s',
    async (scenario) => {
      isFeatureEnabled.mockResolvedValue(true);
      if (scenario === 'unmatched part') {
        findAttachments.mockResolvedValue([
          attachment('attachment-1', 'file-1'),
        ]);
        findFiles.mockResolvedValue([remoteFile('file-1', 'unmatched')]);
      }
      const content = `  ${snapshotContent([part('inline-image')])}\n`;
      await saveSnapshot(content);

      expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
      expect(insertedMappings()).toEqual([]);
    },
  );

  it.each(['flag off', 'unsupported provider', 'unsupported format'])(
    'clears old mappings and preserves bytes with %s',
    async (scenario) => {
      const content = `  ${snapshotContent([part('2')])}\n`;
      const provider =
        scenario === 'unsupported provider' ? 'microsoft' : 'gmail';
      const contentFormat =
        scenario === 'unsupported format'
          ? 'other/1'
          : rawContent.contentFormat;
      findRawContents.mockResolvedValue([
        buildStoredRow({
          rawContent: content,
          provider,
          contentFormat,
          twentyAttachments: [
            {
              partPath: '2',
              mimePartId: '2',
              attachmentId: 'old',
              fileId: 'old',
              match: 'association',
            },
          ],
        }),
      ]);

      await save([
        buildMessage({
          rawContent: { ...rawContent, content, provider, contentFormat },
        }),
      ]);

      expect(updateMany).toHaveBeenCalledWith([
        {
          criteria: 'raw-1',
          partialEntity: expect.objectContaining({
            rawContent: content,
            twentyAttachments: [],
          }),
        },
      ]);
      expect(findAttachments).not.toHaveBeenCalled();
      expect(findFiles).not.toHaveBeenCalled();
      if (scenario !== 'flag off') {
        expect(isFeatureEnabled).not.toHaveBeenCalled();
      }
    },
  );

  it('omits snapshot-only inline images and calendars beside a matched attachment', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([attachment('attachment-1', 'file-1')]);
    findFiles.mockResolvedValue([remoteFile('file-1', '3')]);
    const content = snapshotContent([
      part('1', { filename: 'image.png', content_type: 'image/png' }),
      part('2', { filename: 'invite.ics', content_type: 'text/calendar' }),
      part('3'),
    ]);

    await saveSnapshot(content);

    expect(insertedMappings()).toEqual([
      expect.objectContaining({ mimePartId: '3' }),
    ]);
    expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
  });

  it('matches sent duplicate names by size and file input order, skipping a failed middle upload', async () => {
    isFeatureEnabled.mockResolvedValue(true);
    findAttachments.mockResolvedValue([
      attachment('attachment-3', 'file-3'),
      attachment('attachment-1', 'file-1'),
    ]);
    findFiles.mockResolvedValue([
      { id: 'file-3', size: 30, remoteOrigin: null },
      { id: 'file-1', size: 10, remoteOrigin: null },
    ]);
    const content = snapshotContent([
      part('1'),
      part('2', { size_bytes: 20 }),
      part('3', { size_bytes: 30 }),
    ]);
    await saveSnapshot(content, {
      attachmentFiles: [
        { fileId: 'file-1', label: 'report.pdf' },
        { fileId: 'file-3', label: 'report.pdf' },
      ],
    });

    expect(insertedMappings()).toEqual([
      {
        partPath: '1',
        mimePartId: '1',
        attachmentId: 'attachment-1',
        fileId: 'file-1',
        match: 'sent',
      },
      {
        partPath: '3',
        mimePartId: '3',
        attachmentId: 'attachment-3',
        fileId: 'file-3',
        match: 'sent',
      },
    ]);
    expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
  });

  it.each(['missing upload', 'wrong size', 'wrong name', 'not sent'])(
    'omits a sent candidate for %s',
    async (scenario) => {
      isFeatureEnabled.mockResolvedValue(true);
      findAttachments.mockResolvedValue([attachment('attachment-1', 'file-1')]);
      findFiles.mockResolvedValue(
        scenario === 'missing upload'
          ? []
          : [
              {
                id: 'file-1',
                size: scenario === 'wrong size' ? 99 : 10,
                remoteOrigin: null,
              },
            ],
      );
      const content = ` ${snapshotContent([part('2')])}`;
      await saveSnapshot(content, {
        attachmentFiles:
          scenario === 'not sent'
            ? undefined
            : [
                {
                  fileId: 'file-1',
                  label: scenario === 'wrong name' ? 'other.pdf' : 'report.pdf',
                },
              ],
      });

      expect(insert.mock.calls[0][0][0].rawContent).toBe(content);
      expect(insertedMappings()).toEqual([]);
    },
  );

  it('propagates repository failures rather than losing raw content', async () => {
    insert.mockRejectedValueOnce(new Error('write failed'));
    await expect(save()).rejects.toThrow('write failed');
  });
});
