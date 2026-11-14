import { FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED } from 'twenty-shared/constants';
import {
  ConnectedAccountProvider,
  MessageChannelVisibility,
} from 'twenty-shared/types';

import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import {
  MessagingMessageChannelDeletionCleanupJob,
  type MessagingMessageChannelDeletionCleanupJobData,
} from 'src/modules/messaging/message-cleaner/jobs/messaging-message-channel-deletion-cleanup.job';

import { findManyOperationFactory } from 'test/integration/graphql/utils/find-many-operation-factory.util';
import { makeGraphqlApiRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { makeGraphqlApiRequestWithMemberRole } from 'test/integration/graphql/utils/make-graphql-api-request-with-member-role.util';
import { getGmailMessageSubject } from 'test/integration/google/mocks/gmail-message-subject.util';
import { gmailMessage } from 'test/integration/google/mocks/gmail-message.util';
import { setupGoogleMock } from 'test/integration/google/mocks/setup-google-mock.util';
import { connectMessagingAccount } from 'test/integration/utils/connect-messaging-account.util';
import { enqueueJobAndDrain } from 'test/integration/utils/enqueue-job-and-drain.util';
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
  messageId: string;
  messageChannelMessageAssociationId: string;
};

type MessageAssociation = {
  id: string;
  messageId: string;
  messageExternalId: string;
};

describe('Gmail message raw content (integration) @custom', () => {
  const inbox = [gmailMessage({ snippet: 'Preview' }), gmailMessage()];

  setupGoogleMock({ handle: HANDLE, inbox });

  let channel: Awaited<ReturnType<typeof connectMessagingAccount>>;
  let workspaceId: string;
  let messageIds: string[];
  let associations: MessageAssociation[];
  let fullRawContents: RawContent[];

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
          'id provider contentFormat rawContent metadata messageId messageChannelMessageAssociationId',
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
    fullRawContents = await readRawContentsAs(makeGraphqlApiRequest);
  }, 120000);

  afterAll(async () => {
    await channel?.cleanup().catch(() => undefined);
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
      expect(row.metadata).toBeNull();
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
        expect(row.provider).toBe('gmail');
        expect(row.contentFormat).toBe('email-semantic-snapshot/1');
      }
    }
  }, 60000);

  it('removes the channel raw content when the channel cleanup job finishes', async () => {
    expect(await readRawContentsAs(makeGraphqlApiRequest)).toHaveLength(
      inbox.length,
    );

    await enqueueJobAndDrain<MessagingMessageChannelDeletionCleanupJobData>({
      queue: MessageQueue.messagingQueue,
      jobName: MessagingMessageChannelDeletionCleanupJob.name,
      data: { workspaceId, messageChannelId: channel.channelId },
      scope: { workspaceId, isWorkspaceJob: true },
    });

    expect(await readRawContentsAs(makeGraphqlApiRequest)).toEqual([]);
  }, 120000);
});
