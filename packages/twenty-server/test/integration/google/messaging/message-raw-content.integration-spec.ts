import { type FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { type MessageRawContentAttachment } from 'src/modules/messaging/common/types/message-raw-content-attachment.type';
import { buildGmailEmailSnapshot } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/build-gmail-email-snapshot.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { getAppProviderByClassName } from 'test/integration/utils/get-app-provider-by-class-name.util';
import { FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED } from 'twenty-shared/constants';
import {
  ConnectedAccountProvider,
  FeatureFlagKey,
  MessageChannelVisibility,
} from 'twenty-shared/types';

import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';

import { findManyOperationFactory } from 'test/integration/graphql/utils/find-many-operation-factory.util';
import { makeGraphqlApiRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { makeGraphqlApiRequestWithMemberRole } from 'test/integration/graphql/utils/make-graphql-api-request-with-member-role.util';
import { getGmailMessageSubject } from 'test/integration/google/mocks/gmail-message-subject.util';
import { gmailMessage } from 'test/integration/google/mocks/gmail-message.util';
import { setupGoogleMock } from 'test/integration/google/mocks/setup-google-mock.util';
import { connectMessagingAccount } from 'test/integration/utils/connect-messaging-account.util';
import { findRecordNodesByFilter } from 'test/integration/utils/find-records-by-filter.util';
import { getCoreRepository } from 'test/integration/utils/get-core-repository.util';
import { runMessageChannelSync } from 'test/integration/utils/run-message-channel-sync.util';

const HANDLE = 'gmail-message-raw-content@apple.dev';

type RawContent = {
  id: string;
  provider: string;
  contentFormat: string;
  rawContent: string;
  metadata: unknown;
  twentyAttachments: MessageRawContentAttachment[] | null;
  messageId: string;
  messageChannelMessageAssociationId: string;
};

type MessageAssociation = {
  id: string;
  messageId: string;
  messageExternalId: string;
};

describe('Gmail message raw content (integration) @custom', () => {
  const withAttachment = gmailMessage({ snippet: 'Preview' });
  withAttachment.payload = {
    ...withAttachment.payload,
    mimeType: 'multipart/mixed',
    body: {},
    parts: [
      {
        mimeType: 'text/plain',
        partId: '0',
        body: { data: Buffer.from('Hello').toString('base64url') },
      },
      {
        mimeType: 'application/pdf',
        partId: '1',
        filename: 'report.pdf',
        body: { attachmentId: 'pdf-attachment', size: 12 },
      },
    ],
  };
  const inbox = [withAttachment, gmailMessage()];

  setupGoogleMock({ handle: HANDLE, inbox });

  let channel: Awaited<ReturnType<typeof connectMessagingAccount>>;
  let workspaceId: string;
  let messageIds: string[];
  let associations: MessageAssociation[];
  let fullRawContents: RawContent[];
  let attachmentsWereEnabled: boolean | undefined;

  const readRawContentsAs = async (
    makeRequest:
      | typeof makeGraphqlApiRequest
      | typeof makeGraphqlApiRequestWithMemberRole,
  ): Promise<RawContent[]> => {
    const response = await makeRequest(
      findManyOperationFactory({
        objectMetadataSingularName: 'messageRawContent',
        objectMetadataPluralName: 'messageRawContents',
        gqlFields:
          'id provider contentFormat rawContent metadata twentyAttachments messageId messageChannelMessageAssociationId',
        filter: { messageId: { in: messageIds } },
      }),
    );

    expect(response.body.errors).toBeUndefined();

    return response.body.data.messageRawContents.edges.map(
      (edge: { node: RawContent }) => edge.node,
    );
  };

  const setVisibility = async (visibility: MessageChannelVisibility) => {
    await getCoreRepository<MessageChannelEntity>(MessageChannelEntity).update(
      { id: channel.channelId },
      { visibility },
    );
  };

  beforeAll(async () => {
    channel = await connectMessagingAccount({
      provider: ConnectedAccountProvider.GOOGLE,
      handle: HANDLE,
    });

    workspaceId = (
      await getCoreRepository<MessageChannelEntity>(
        MessageChannelEntity,
      ).findOneByOrFail({ id: channel.channelId })
    ).workspaceId;

    const featureFlagService =
      getAppProviderByClassName<FeatureFlagService>('FeatureFlagService');

    attachmentsWereEnabled = await featureFlagService.isFeatureEnabled(
      FeatureFlagKey.IS_MESSAGE_ATTACHMENT_ENABLED,
      workspaceId,
    );
    await featureFlagService.enableFeatureFlags(
      [FeatureFlagKey.IS_MESSAGE_ATTACHMENT_ENABLED],
      workspaceId,
    );
    await runMessageChannelSync(channel.channelId);

    const messages = await findRecordNodesByFilter<{ id: string }>(
      'message',
      'messages',
      'id',
      { subject: { in: inbox.map(getGmailMessageSubject) } },
    );

    messageIds = messages.map((message) => message.id);
    associations = await findRecordNodesByFilter<MessageAssociation>(
      'messageChannelMessageAssociation',
      'messageChannelMessageAssociations',
      'id messageId messageExternalId',
      { messageChannelId: { eq: channel.channelId } },
    );
    const schema = getWorkspaceSchemaName(workspaceId);

    await global.testDataSource.query(
      `UPDATE "${schema}"."messageRawContent" SET metadata = $1::jsonb WHERE "messageId" = ANY($2::uuid[])`,
      [JSON.stringify({ private: 'channel metadata' }), messageIds],
    );
    fullRawContents = await readRawContentsAs(makeGraphqlApiRequest);
  }, 120000);

  afterAll(async () => {
    await channel?.cleanup().catch(() => undefined);
    if (attachmentsWereEnabled === false) {
      await getAppProviderByClassName<FeatureFlagService>(
        'FeatureFlagService',
      ).upsertWorkspaceFeatureFlag({
        workspaceId,
        featureFlag: FeatureFlagKey.IS_MESSAGE_ATTACHMENT_ENABLED,
        value: false,
      });
    }
  });

  it('persists one semantic snapshot per imported message and channel association', () => {
    expect(messageIds).toHaveLength(inbox.length);
    expect(associations).toHaveLength(inbox.length);
    expect(
      associations.map((association) => association.messageExternalId).sort(),
    ).toEqual(inbox.map((message) => message.id).sort());
    expect(fullRawContents).toHaveLength(inbox.length);

    for (const messageId of messageIds) {
      const rows = fullRawContents.filter((row) => row.messageId === messageId);

      expect(rows).toHaveLength(1);

      const [row] = rows;
      const association = associations.find(
        (candidate) => candidate.id === row.messageChannelMessageAssociationId,
      );

      expect(association).toBeDefined();
      expect(association?.messageId).toBe(messageId);
      expect(row.provider).toBe('gmail');
      expect(row.contentFormat).toBe('email-semantic-snapshot/1');
      expect(row.metadata).toEqual({ private: 'channel metadata' });
      expect(JSON.parse(row.rawContent)).toMatchObject({
        schema: 'email-semantic-snapshot',
        schema_version: 1,
        source: {
          provider: 'gmail',
          message_id: association?.messageExternalId,
        },
      });
      JSON.parse(row.rawContent, (key, value: unknown) => {
        expect(['labelIds', 'snippet', 'historyId']).not.toContain(key);

        return value;
      });
    }
  });

  it('shows full raw content to the connected account owner under metadata visibility', async () => {
    await setVisibility(MessageChannelVisibility.METADATA);

    const rows = await readRawContentsAs(makeGraphqlApiRequest);

    expect(rows).toHaveLength(inbox.length);
    expect(rows).toEqual(expect.arrayContaining(fullRawContents));
  }, 60000);

  it('shows full raw content to another member when the channel shares everything', async () => {
    await setVisibility(MessageChannelVisibility.SHARE_EVERYTHING);

    const rows = await readRawContentsAs(makeGraphqlApiRequestWithMemberRole);

    expect(rows).toHaveLength(inbox.length);
    expect(rows).toEqual(expect.arrayContaining(fullRawContents));
  }, 60000);

  it('restricts raw content for another member under subject and metadata visibility', async () => {
    for (const visibility of [
      MessageChannelVisibility.SUBJECT,
      MessageChannelVisibility.METADATA,
    ]) {
      await setVisibility(visibility);

      const rows = await readRawContentsAs(makeGraphqlApiRequestWithMemberRole);

      expect(rows).toHaveLength(inbox.length);
      for (const row of rows) {
        expect(row.rawContent).toBe(
          FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
        );
        expect(row.metadata).toBeNull();
        expect(row.twentyAttachments).toBeNull();
        expect(row.provider).toBe('gmail');
        expect(row.contentFormat).toBe('email-semantic-snapshot/1');
      }
    }
  }, 60000);

  it('stores separate attachment mappings without changing provider snapshot bytes', async () => {
    const association = associations.find(
      ({ messageExternalId }) => messageExternalId === withAttachment.id,
    );
    const row = fullRawContents.find(
      ({ messageChannelMessageAssociationId }) =>
        messageChannelMessageAssociationId === association?.id,
    );

    expect(row).toBeDefined();
    expect(row?.twentyAttachments).toEqual([
      {
        partPath: '1',
        mimePartId: '1',
        attachmentId: expect.any(String),
        fileId: expect.any(String),
        match: 'association',
      },
    ]);
    expect(row?.rawContent).toBe(
      await buildGmailEmailSnapshot({
        payload: withAttachment.payload!,
        messageId: withAttachment.id!,
        threadId: withAttachment.threadId!,
      }),
    );
    const mapping = row!.twentyAttachments![0];
    const attachments = await findRecordNodesByFilter<{
      id: string;
      file: { fileId: string }[];
    }>('attachment', 'attachments', 'id file { fileId }', {
      id: { eq: mapping.attachmentId },
    });

    expect(attachments).toEqual([
      expect.objectContaining({
        id: mapping.attachmentId,
        file: expect.arrayContaining([
          expect.objectContaining({ fileId: mapping.fileId }),
        ]),
      }),
    ]);
  });

  it('masks mapping-only selection without leaking or adding unselected fields', async () => {
    await setVisibility(MessageChannelVisibility.METADATA);
    const response = await makeGraphqlApiRequestWithMemberRole(
      findManyOperationFactory({
        objectMetadataSingularName: 'messageRawContent',
        objectMetadataPluralName: 'messageRawContents',
        gqlFields: 'id twentyAttachments',
        filter: { messageId: { in: messageIds } },
      }),
    );

    expect(response.body.errors).toBeUndefined();
    const rows = response.body.data.messageRawContents.edges.map(
      (edge: { node: Partial<RawContent> }) => edge.node,
    );

    expect(rows).toHaveLength(inbox.length);
    for (const row of rows) {
      expect(row).toEqual({ id: expect.any(String), twentyAttachments: null });
    }
  });

  it('cascades raw rows when their association or message is physically deleted', async () => {
    const schema = getWorkspaceSchemaName(workspaceId);
    await global.testDataSource.query(
      `DELETE FROM "${schema}"."messageChannelMessageAssociation" WHERE id = $1`,
      [associations[0].id],
    );
    expect(await readRawContentsAs(makeGraphqlApiRequest)).toHaveLength(1);
    await global.testDataSource.query(
      `DELETE FROM "${schema}"."message" WHERE id = $1`,
      [associations[1].messageId],
    );
    expect(await readRawContentsAs(makeGraphqlApiRequest)).toEqual([]);
  });
});
