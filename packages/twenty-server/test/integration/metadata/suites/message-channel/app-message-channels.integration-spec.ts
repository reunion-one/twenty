import { EventEmitter2 } from '@nestjs/event-emitter';
import { gql } from 'graphql-tag';
import { buildBaseManifest } from 'test/integration/metadata/suites/application/utils/build-base-manifest.util';
import { cleanupApplicationAndAppRegistration } from 'test/integration/metadata/suites/application/utils/cleanup-application-and-app-registration.util';
import { generateAppleAdminApplicationTokenPair } from 'test/integration/utils/generate-apple-admin-application-token-pair.util';
import { setupApplicationForSync } from 'test/integration/metadata/suites/application/utils/setup-application-for-sync.util';
import { syncApplication } from 'test/integration/metadata/suites/application/utils/sync-application.util';
import { findConnectionProvidersByApplication } from 'test/integration/metadata/suites/connection-provider/utils/find-connection-providers-by-application.util';
import { findOneOperationFactory } from 'test/integration/graphql/utils/find-one-operation-factory.util';
import { makeGraphqlApiRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { makeRestApiRequest } from 'test/integration/rest/utils/make-rest-api-request.util';
import { makeMetadataApiRequest } from 'test/integration/metadata/suites/utils/make-metadata-api-request.util';
import { type Manifest } from 'twenty-shared/application';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { type ObjectRecordUpdateEvent } from 'twenty-shared/database-events';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import { transformEventBatchToWebhookEvents } from 'src/engine/metadata-modules/webhook/utils/transform-event-batch-to-webhook-events';
import { type WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';
import { getAppProviderByClassName } from 'test/integration/utils/get-app-provider-by-class-name.util';
import {
  ConnectedAccountProvider,
  MessageChannelType,
  MessageChannelVisibility,
  MessageParticipantRole,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { v4 as uuidv4 } from 'uuid';
import { type ObjectLiteral } from 'typeorm';

import { INGEST_APP_MESSAGES_MAX_BATCH_SIZE } from 'src/engine/metadata-modules/message-channel/dtos/ingest-app-messages.input';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { MessagingMessageService } from 'src/modules/messaging/message-import-manager/services/messaging-message.service';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel-message-association.workspace-entity';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { MessagingMessageCleanerService } from 'src/modules/messaging/message-cleaner/services/messaging-message-cleaner.service';
import { formatRawMimeMessage } from 'src/modules/messaging/message-import-manager/utils/format-raw-mime-message.util';

const OWNING_APP_ID = uuidv4();
const OWNING_APP_ROLE_ID = uuidv4();
const OWNING_APP_PROVIDER_ID = uuidv4();

const OTHER_APP_ID = uuidv4();
const OTHER_APP_ROLE_ID = uuidv4();
const OTHER_APP_PROVIDER_ID = uuidv4();

const WORKSPACE_SCHEMA = getWorkspaceSchemaName(SEED_APPLE_WORKSPACE_ID);

const CHANNEL_HANDLE = 'workspace-bot@linkedin.test';

const CREATE_CHANNEL_MUTATION = gql`
  mutation CreateAppMessageChannel($input: CreateAppMessageChannelInput!) {
    createAppMessageChannel(input: $input) {
      id
      handle
      displayName
      type
      visibility
      isSyncEnabled
      connectedAccountId
    }
  }
`;

const LIST_CHANNELS_QUERY = gql`
  query AppMessageChannels($filter: ListAppMessageChannelsInput) {
    appMessageChannels(filter: $filter) {
      id
      handle
      type
      connectedAccountId
    }
  }
`;

const UPDATE_CHANNEL_MUTATION = gql`
  mutation UpdateAppMessageChannel($input: UpdateAppMessageChannelInput!) {
    updateAppMessageChannel(input: $input) {
      id
      displayName
      visibility
      isSyncEnabled
    }
  }
`;

const DELETE_CHANNEL_MUTATION = gql`
  mutation DeleteAppMessageChannel($id: UUID!) {
    deleteAppMessageChannel(id: $id) {
      id
    }
  }
`;

const INGEST_MESSAGES_MUTATION = gql`
  mutation IngestAppMessages($input: IngestAppMessagesInput!) {
    ingestAppMessages(input: $input) {
      messages {
        externalId
        messageId
        messageThreadId
      }
    }
  }
`;

const buildManifestWithProvider = ({
  appId,
  roleId,
  roleLabel,
  providerId,
}: {
  appId: string;
  roleId: string;
  roleLabel: string;
  providerId: string;
}): Manifest =>
  buildBaseManifest({
    appId,
    roleId,
    overrides: {
      roles: [
        {
          universalIdentifier: roleId,
          label: roleLabel,
          description: 'A test role',
        },
      ],
      connectionProviders: [
        {
          universalIdentifier: providerId,
          name: 'linkedin',
          displayName: 'LinkedIn',
          type: 'oauth',
          oauth: {
            authorizationEndpoint:
              'https://www.linkedin.com/oauth/v2/authorization',
            tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
            scopes: ['r_liteprofile'],
            clientIdVariable: 'LINKEDIN_CLIENT_ID',
            clientSecretVariable: 'LINKEDIN_CLIENT_SECRET',
          },
        },
      ],
    },
  });

type AppMessageParticipantPayload = {
  role: MessageParticipantRole;
  handle: string;
  displayName?: string;
  personId?: string;
};

type AppMessagePayload = {
  externalId: string;
  threadExternalId: string;
  subject?: string;
  text: string;
  receivedAt: string;
  rawProviderData?: Record<string, unknown> | null;
  participants: AppMessageParticipantPayload[];
};

const buildMessage = ({
  externalId,
  threadExternalId,
  senderHandle,
  text = 'Hi there',
  subject,
  personId,
  rawProviderData,
}: {
  externalId: string;
  threadExternalId: string;
  senderHandle: string;
  text?: string;
  subject?: string;
  personId?: string;
  rawProviderData?: Record<string, unknown> | null;
}): AppMessagePayload => ({
  externalId,
  threadExternalId,
  subject,
  text,
  rawProviderData,
  receivedAt: new Date('2026-01-01T10:00:00.000Z').toISOString(),
  participants: [
    {
      role: MessageParticipantRole.FROM,
      handle: senderHandle,
      displayName: 'Ada Lovelace',
      personId,
    },
    {
      role: MessageParticipantRole.TO,
      handle: 'recruiter@linkedin.test',
    },
  ],
});

describe('app message channels API (e2e)', () => {
  let owningApplicationToken: string;
  let otherApplicationToken: string;
  let adminUserWorkspaceId: string;
  let owningApplicationDbId: string;
  let owningProviderDbId: string;
  let otherApplicationDbId: string;
  let otherProviderDbId: string;

  let ownConnectionId: string;
  let otherAppConnectionId: string;
  let foreignMemberConnectionId: string;

  const insertAppConnection = async ({
    id,
    applicationId,
    connectionProviderId,
    visibility,
    userWorkspaceId,
  }: {
    id: string;
    applicationId: string;
    connectionProviderId: string;
    visibility: 'user' | 'workspace';
    userWorkspaceId: string;
  }): Promise<void> => {
    await globalThis.testDataSource.query(
      `INSERT INTO core."connectedAccount"
         (id, handle, provider, visibility, "workspaceId", "userWorkspaceId",
          "applicationId", "connectionProviderId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        CHANNEL_HANDLE,
        ConnectedAccountProvider.APP,
        visibility,
        SEED_APPLE_WORKSPACE_ID,
        userWorkspaceId,
        applicationId,
        connectionProviderId,
      ],
    );
  };

  const request = (
    operation: Parameters<typeof makeMetadataApiRequest>[0],
    token = owningApplicationToken,
  ) => makeMetadataApiRequest(operation, token);

  const createChannel = ({
    connectedAccountId = ownConnectionId,
    handle = CHANNEL_HANDLE,
    displayName,
    visibility = MessageChannelVisibility.SHARE_EVERYTHING,
    token,
  }: {
    connectedAccountId?: string;
    handle?: string;
    displayName?: string;
    visibility?: MessageChannelVisibility;
    token?: string;
  } = {}) =>
    request(
      {
        query: CREATE_CHANNEL_MUTATION,
        variables: {
          input: { connectedAccountId, handle, displayName, visibility },
        },
      },
      token,
    );

  const createChannelOrThrow = async (
    args: Parameters<typeof createChannel>[0] = {},
  ): Promise<{ id: string; handle: string }> => {
    const response = await createChannel(args);

    if (response.body.errors) {
      throw new Error(
        `Channel creation failed: ${JSON.stringify(response.body.errors)}`,
      );
    }

    return response.body.data.createAppMessageChannel;
  };

  const ingest = ({
    messageChannelId,
    messages,
    token,
  }: {
    messageChannelId: string;
    messages: AppMessagePayload[];
    token?: string;
  }) =>
    request(
      {
        query: INGEST_MESSAGES_MUTATION,
        variables: { input: { messageChannelId, messages } },
      },
      token,
    );

  const findAssociation = async (
    messageId: string,
  ): Promise<{ direction: string; messageExternalId: string }> => {
    const [row] = await globalThis.testDataSource.query(
      `SELECT direction, "messageExternalId"
         FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
        WHERE "messageId" = $1`,
      [messageId],
    );

    return row;
  };

  beforeAll(async () => {
    for (const { appId, roleId, providerId, sourcePath } of [
      {
        appId: OWNING_APP_ID,
        roleId: OWNING_APP_ROLE_ID,
        providerId: OWNING_APP_PROVIDER_ID,
        sourcePath: 'test-app-message-channels-owner',
      },
      {
        appId: OTHER_APP_ID,
        roleId: OTHER_APP_ROLE_ID,
        providerId: OTHER_APP_PROVIDER_ID,
        sourcePath: 'test-app-message-channels-other',
      },
    ]) {
      await setupApplicationForSync({
        applicationUniversalIdentifier: appId,
        name: sourcePath,
        description: 'App for testing the app-facing message channel API',
        sourcePath,
      });

      await syncApplication({
        manifest: buildManifestWithProvider({
          appId,
          roleId,
          roleLabel: `Test Role ${sourcePath}`,
          providerId,
        }),
        expectToFail: false,
      });
    }

    jest.useRealTimers();

    const [owningProvider] =
      await findConnectionProvidersByApplication(OWNING_APP_ID);
    const [otherProvider] =
      await findConnectionProvidersByApplication(OTHER_APP_ID);

    owningApplicationDbId = owningProvider.applicationId;
    owningProviderDbId = owningProvider.id;
    otherApplicationDbId = otherProvider.applicationId;
    otherProviderDbId = otherProvider.id;

    const [userWorkspace] = await globalThis.testDataSource.query(
      `SELECT id FROM core."userWorkspace" WHERE "workspaceId" = $1 LIMIT 1`,
      [SEED_APPLE_WORKSPACE_ID],
    );

    adminUserWorkspaceId = userWorkspace.id;

    // Carries the admin's userWorkspaceId: the shape of a member-triggered run rather than a cron.
    const tokenPair = await generateAppleAdminApplicationTokenPair({
      applicationId: owningApplicationDbId,
    });

    owningApplicationToken = tokenPair.applicationAccessToken.token;

    const otherApplicationTokenPair =
      await generateAppleAdminApplicationTokenPair({
        applicationId: otherApplicationDbId,
      });

    otherApplicationToken =
      otherApplicationTokenPair.applicationAccessToken.token;

    ownConnectionId = uuidv4();
    otherAppConnectionId = uuidv4();
    foreignMemberConnectionId = uuidv4();

    await insertAppConnection({
      id: ownConnectionId,
      applicationId: owningApplicationDbId,
      connectionProviderId: owningProviderDbId,
      visibility: 'workspace',
      userWorkspaceId: adminUserWorkspaceId,
    });

    await insertAppConnection({
      id: otherAppConnectionId,
      applicationId: otherApplicationDbId,
      connectionProviderId: otherProviderDbId,
      visibility: 'workspace',
      userWorkspaceId: adminUserWorkspaceId,
    });

    await insertAppConnection({
      id: foreignMemberConnectionId,
      applicationId: owningApplicationDbId,
      connectionProviderId: owningProviderDbId,
      visibility: 'user',
      userWorkspaceId: uuidv4(),
    });
  }, 180000);

  afterEach(async () => {
    const ingestedMessages: { id: string; messageThreadId: string | null }[] =
      await globalThis.testDataSource.query(
        `SELECT id, "messageThreadId" FROM "${WORKSPACE_SCHEMA}"."message"
           WHERE "headerMessageId" LIKE $1`,
        [`app:${owningApplicationDbId}:%`],
      );

    const messageIds = ingestedMessages.map((message) => message.id);
    const messageThreadIds = [
      ...new Set(
        ingestedMessages
          .map((message) => message.messageThreadId)
          .filter(isDefined),
      ),
    ];

    if (messageIds.length > 0) {
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociationMessageFolder"
           WHERE "messageChannelMessageAssociationId" IN (
             SELECT id FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
              WHERE "messageId" = ANY($1))`,
        [messageIds],
      );
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
           WHERE "messageId" = ANY($1)`,
        [messageIds],
      );
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."messageParticipant"
           WHERE "messageId" = ANY($1)`,
        [messageIds],
      );
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = ANY($1)`,
        [messageIds],
      );
    }

    if (messageThreadIds.length > 0) {
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."messageThreadTarget"
           WHERE "messageThreadId" = ANY($1)`,
        [messageThreadIds],
      );
      await globalThis.testDataSource.query(
        `DELETE FROM "${WORKSPACE_SCHEMA}"."messageThread" WHERE id = ANY($1)`,
        [messageThreadIds],
      );
    }

    await globalThis.testDataSource.query(
      `DELETE FROM core."messageChannel" WHERE "connectedAccountId" = ANY($1)`,
      [[ownConnectionId, otherAppConnectionId, foreignMemberConnectionId]],
    );
  });

  afterAll(async () => {
    await globalThis.testDataSource.query(
      `DELETE FROM core."connectedAccount" WHERE "workspaceId" = $1
         AND "applicationId" IN ($2, $3)`,
      [SEED_APPLE_WORKSPACE_ID, owningApplicationDbId, otherApplicationDbId],
    );

    for (const appId of [OWNING_APP_ID, OTHER_APP_ID]) {
      await cleanupApplicationAndAppRegistration({
        applicationUniversalIdentifier: appId,
      });
    }
  }, 120000);

  describe('createAppMessageChannel', () => {
    it('creates an APP channel on a connection the application owns', async () => {
      const response = await createChannel({
        displayName: '  Ada at LinkedIn  ',
      });

      expect(response.body.errors).toBeUndefined();

      const channel = response.body.data.createAppMessageChannel;

      expect(channel).toMatchObject({
        handle: CHANNEL_HANDLE,
        // Trimmed so the UI never renders a padded label.
        displayName: 'Ada at LinkedIn',
        type: MessageChannelType.APP,
        visibility: MessageChannelVisibility.SHARE_EVERYTHING,
        isSyncEnabled: true,
        connectedAccountId: ownConnectionId,
      });
    });

    it('refuses a connection owned by another application', async () => {
      const response = await createChannel({
        connectedAccountId: otherAppConnectionId,
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it("refuses another member's private connection", async () => {
      const response = await createChannel({
        connectedAccountId: foreignMemberConnectionId,
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });

    it('refuses a second channel for the same handle on the same connection', async () => {
      await createChannelOrThrow();

      const response = await createChannel();

      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_USER_INPUT',
      );
    });

    it('rejects a missing visibility rather than defaulting one', async () => {
      const response = await request({
        query: gql`
          mutation CreateAppMessageChannelWithoutVisibility(
            $connectedAccountId: UUID!
            $handle: String!
          ) {
            createAppMessageChannel(
              input: {
                connectedAccountId: $connectedAccountId
                handle: $handle
              }
            ) {
              id
            }
          }
        `,
        variables: {
          connectedAccountId: ownConnectionId,
          handle: CHANNEL_HANDLE,
        },
      });

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('appMessageChannels', () => {
    it("lists the application's own channels and nothing else", async () => {
      const channel = await createChannelOrThrow();
      // Same workspace and type APP, so a list query not scoped by application would return it.
      const foreignChannel = await createChannelOrThrow({
        connectedAccountId: otherAppConnectionId,
        token: otherApplicationToken,
      });

      const response = await request({ query: LIST_CHANNELS_QUERY });

      expect(response.body.errors).toBeUndefined();

      const channels = response.body.data.appMessageChannels;

      expect(channels).toHaveLength(1);
      expect(channels[0]).toMatchObject({
        id: channel.id,
        type: MessageChannelType.APP,
        connectedAccountId: ownConnectionId,
      });
      expect(channels.map((listed: { id: string }) => listed.id)).not.toContain(
        foreignChannel.id,
      );
    });

    it('refuses a filter on a connection owned by another application', async () => {
      const response = await request({
        query: LIST_CHANNELS_QUERY,
        variables: { filter: { connectedAccountId: otherAppConnectionId } },
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('updateAppMessageChannel', () => {
    it('updates the fields an app is allowed to change', async () => {
      const channel = await createChannelOrThrow();

      const response = await request({
        query: UPDATE_CHANNEL_MUTATION,
        variables: {
          input: {
            id: channel.id,
            displayName: 'Renamed',
            visibility: MessageChannelVisibility.METADATA,
            isSyncEnabled: false,
          },
        },
      });

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.updateAppMessageChannel).toMatchObject({
        id: channel.id,
        displayName: 'Renamed',
        visibility: MessageChannelVisibility.METADATA,
        isSyncEnabled: false,
      });
    });

    it('does not tell another application that the channel exists', async () => {
      const channel = await createChannelOrThrow();

      const response = await request(
        {
          query: UPDATE_CHANNEL_MUTATION,
          variables: { input: { id: channel.id, displayName: 'Stolen' } },
        },
        otherApplicationToken,
      );

      expect(response.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });
  });

  describe('deleteAppMessageChannel', () => {
    it('removes the channel from the list', async () => {
      const channel = await createChannelOrThrow();

      const deleteResponse = await request({
        query: DELETE_CHANNEL_MUTATION,
        variables: { id: channel.id },
      });

      expect(deleteResponse.body.errors).toBeUndefined();
      expect(deleteResponse.body.data.deleteAppMessageChannel.id).toBe(
        channel.id,
      );

      const listResponse = await request({ query: LIST_CHANNELS_QUERY });

      expect(listResponse.body.data.appMessageChannels).toEqual([]);
    });
  });

  describe('ingestAppMessages', () => {
    it('lands two messages of one conversation in a single thread', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'msg-1',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            subject: 'Interested in the role',
          }),
          buildMessage({
            externalId: 'msg-2',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
          }),
        ],
      });

      expect(response.body.errors).toBeUndefined();

      const ingested = response.body.data.ingestAppMessages.messages;

      expect(
        ingested.map((message: { externalId: string }) => message.externalId),
      ).toEqual(['msg-1', 'msg-2']);
      expect(ingested[0].messageId).not.toBe(ingested[1].messageId);
      expect(ingested[0].messageThreadId).toBe(ingested[1].messageThreadId);

      const [message] = await globalThis.testDataSource.query(
        `SELECT subject, text FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
        [ingested[0].messageId],
      );

      expect(message).toMatchObject({
        subject: 'Interested in the role',
        text: 'Hi there',
      });
    });

    it('returns the same ids when a provider redelivers the same message', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;
      const messages = [
        buildMessage({
          externalId: 'redelivered',
          threadExternalId,
          senderHandle: 'candidate@linkedin.test',
        }),
      ];

      const first = await ingest({ messageChannelId: channel.id, messages });
      const second = await ingest({ messageChannelId: channel.id, messages });

      expect(first.body.errors).toBeUndefined();
      expect(second.body.errors).toBeUndefined();
      expect(second.body.data.ingestAppMessages.messages).toEqual(
        first.body.data.ingestAppMessages.messages,
      );

      const [{ count }] = await globalThis.testDataSource.query(
        `SELECT count(*) AS count FROM "${WORKSPACE_SCHEMA}"."message"
           WHERE "headerMessageId" = $1`,
        [`app:${owningApplicationDbId}:${channel.id}:redelivered`],
      );

      expect(Number(count)).toBe(1);
    });

    it('updates only raw provider data on redelivery and exposes it through Message queries @custom', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;
      const initialRawProviderData = {
        providerMessageId: 'source-message-1',
        nested: { value: 'original' },
      };
      const initial = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'raw-provider-data',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            subject: 'Original subject',
            text: 'Original body',
            rawProviderData: initialRawProviderData,
          }),
        ],
      });

      expect(initial.body.errors).toBeUndefined();

      const [ingestedMessage] = initial.body.data.ingestAppMessages.messages;
      const [initialRelatedRecordCounts] =
        await globalThis.testDataSource.query(
          `SELECT
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageParticipant"
             WHERE "messageId" = $1) AS "participantCount",
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
             WHERE "messageId" = $1) AS "associationCount"`,
          [ingestedMessage.messageId],
        );
      const omittedRawUpdate = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'raw-provider-data',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            subject: 'Changed subject',
            text: 'Changed body',
            rawProviderData: null,
          }),
        ],
      });

      expect(omittedRawUpdate.body.errors).toBeUndefined();
      expect(omittedRawUpdate.body.data.ingestAppMessages.messages).toEqual(
        initial.body.data.ingestAppMessages.messages,
      );

      const replacementRawProviderData = {
        providerMessageId: 'source-message-2',
        nested: { value: 'replacement' },
      };
      const workspaceEventEmitter =
        getAppProviderByClassName<WorkspaceEventEmitter>(
          'WorkspaceEventEmitter',
        );
      const emitDatabaseBatchEvent =
        workspaceEventEmitter.emitDatabaseBatchEvent.bind(
          workspaceEventEmitter,
        );
      const eventSpy = jest
        .spyOn(workspaceEventEmitter, 'emitDatabaseBatchEvent')
        .mockImplementation((event) => emitDatabaseBatchEvent(event));
      let replacement: Awaited<ReturnType<typeof ingest>>;

      try {
        replacement = await ingest({
          messageChannelId: channel.id,
          messages: [
            buildMessage({
              externalId: 'raw-provider-data',
              threadExternalId,
              senderHandle: 'candidate@linkedin.test',
              subject: 'Another changed subject',
              text: 'Another changed body',
              rawProviderData: replacementRawProviderData,
            }),
          ],
        });

        const rawProviderDataUpdateBatch = eventSpy.mock.calls
          .map(([event]) => event)
          .find(
            (event) =>
              event?.objectMetadataNameSingular === 'message' &&
              event.action === DatabaseEventAction.UPDATED,
          );
        const rawProviderDataUpdateEvent =
          rawProviderDataUpdateBatch?.events.find(
            (event) => event.recordId === ingestedMessage.messageId,
          );

        expect(rawProviderDataUpdateEvent).toMatchObject({
          properties: {
            updatedFields: expect.arrayContaining(['rawProviderData']),
            after: { rawProviderData: replacementRawProviderData },
          },
        });
      } finally {
        eventSpy.mockRestore();
      }

      expect(replacement.body.errors).toBeUndefined();
      expect(replacement.body.data.ingestAppMessages.messages).toEqual(
        initial.body.data.ingestAppMessages.messages,
      );

      const [message] = await globalThis.testDataSource.query(
        `SELECT subject, text, "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      expect(message).toMatchObject({
        subject: 'Original subject',
        text: 'Original body',
        rawProviderData: replacementRawProviderData,
      });

      const [relatedRecordCounts] = await globalThis.testDataSource.query(
        `SELECT
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageParticipant"
             WHERE "messageId" = $1) AS "participantCount",
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
             WHERE "messageId" = $1) AS "associationCount"`,
        [ingestedMessage.messageId],
      );

      expect(relatedRecordCounts).toEqual(initialRelatedRecordCounts);

      const directMessageQuery = await makeGraphqlApiRequest(
        findOneOperationFactory({
          objectMetadataSingularName: 'message',
          filter: { id: { eq: ingestedMessage.messageId } },
          gqlFields: 'id rawProviderData',
        }),
      );

      expect(directMessageQuery.body.errors).toBeUndefined();
      expect(directMessageQuery.body.data.message).toMatchObject({
        id: ingestedMessage.messageId,
        rawProviderData: replacementRawProviderData,
      });

      const nestedThreadQuery = await makeGraphqlApiRequest(
        findOneOperationFactory({
          objectMetadataSingularName: 'messageThread',
          filter: { id: { eq: ingestedMessage.messageThreadId } },
          gqlFields: `
            id
            messages {
              edges {
                node {
                  id
                  rawProviderData
                }
              }
            }
          `,
        }),
      );

      expect(nestedThreadQuery.body.errors).toBeUndefined();
      expect(
        nestedThreadQuery.body.data.messageThread.messages.edges,
      ).toContainEqual({
        node: {
          id: ingestedMessage.messageId,
          rawProviderData: replacementRawProviderData,
        },
      });

      const restRead = await makeRestApiRequest({
        method: 'get',
        path: `/messages/${ingestedMessage.messageId}?fields=rawProviderData`,
      });

      expect(restRead.status).toBe(200);
      expect(restRead.body.data.message).toMatchObject({
        id: ingestedMessage.messageId,
        rawProviderData: replacementRawProviderData,
      });

      const restDefaultRead = await makeRestApiRequest({
        method: 'get',
        path: `/messages/${ingestedMessage.messageId}`,
      });

      expect(restDefaultRead.status).toBe(200);
      expect(restDefaultRead.body.data.message).toMatchObject({
        rawProviderData: replacementRawProviderData,
      });

      const restWrite = await makeRestApiRequest({
        method: 'patch',
        path: `/messages/${ingestedMessage.messageId}`,
        body: {
          rawProviderData: { providerMessageId: 'manual-mutation' },
        },
      });

      expect(restWrite.status).toBe(400);
      const [messageAfterRejectedRestWrite] =
        await globalThis.testDataSource.query(
          `SELECT "rawProviderData"
             FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
          [ingestedMessage.messageId],
        );

      expect(messageAfterRejectedRestWrite).toEqual({
        rawProviderData: replacementRawProviderData,
      });
    });

    it('measures MIME attachment data through REST and webhook event serialization @custom', async () => {
      const createRawMimeProviderData = (
        attachmentBytes: number,
        fill: number,
      ) => {
        const attachmentBase64 =
          Buffer.alloc(attachmentBytes, fill)
            .toString('base64')
            .match(/.{1,76}/g)
            ?.join('\r\n') ?? '';
        const rawMimeMessage = Buffer.from(
          [
            'MIME-Version: 1.0',
            'Content-Type: multipart/mixed; boundary="mixed-boundary"',
            '',
            '--mixed-boundary',
            'Content-Type: application/octet-stream; name="attachment.bin"',
            'Content-Transfer-Encoding: base64',
            'Content-Disposition: attachment; filename="attachment.bin"',
            '',
            attachmentBase64,
            '--mixed-boundary--',
            '',
          ].join('\r\n'),
          'ascii',
        );

        return {
          mimeBytes: rawMimeMessage.byteLength,
          rawProviderData: formatRawMimeMessage(rawMimeMessage),
        };
      };
      const attachmentBytes = 1024 * 1024;
      const initialMime = createRawMimeProviderData(attachmentBytes, 0);
      const replacementMime = createRawMimeProviderData(attachmentBytes, 1);
      const channel = await createChannelOrThrow();
      const threadExternalId = `mime-raw-size-${uuidv4()}`;
      const initial = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'mime-raw-size-probe',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            rawProviderData: { providerMessageId: 'before-mime-probe' },
          }),
        ],
      });

      expect(initial.body.errors).toBeUndefined();

      const [ingestedMessage] = initial.body.data.ingestAppMessages.messages;
      const [persistedMessage]: {
        headerMessageId: string;
      }[] = await globalThis.testDataSource.query(
        `SELECT "headerMessageId" FROM "${WORKSPACE_SCHEMA}"."message"
          WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      await globalThis.testDataSource.query(
        `UPDATE "${WORKSPACE_SCHEMA}"."message"
            SET "rawProviderData" = $2::jsonb WHERE id = $1`,
        [
          ingestedMessage.messageId,
          JSON.stringify(initialMime.rawProviderData),
        ],
      );

      const workspaceEventEmitter =
        getAppProviderByClassName<WorkspaceEventEmitter>(
          'WorkspaceEventEmitter',
        );
      const eventEmitter = (
        workspaceEventEmitter as unknown as { eventEmitter: EventEmitter2 }
      ).eventEmitter;
      const workspaceOrmManager =
        getAppProviderByClassName<WorkspaceOrmManager>('WorkspaceOrmManager');
      const messagingMessageService =
        getAppProviderByClassName<MessagingMessageService>(
          'MessagingMessageService',
        );
      const replacementMessage = {
        externalId: 'mime-raw-size-probe',
        headerMessageId: persistedMessage.headerMessageId,
        subject: null,
        text: 'Hi there',
        receivedAt: new Date('2026-01-01T10:00:00.000Z'),
        messageThreadExternalId: threadExternalId,
        direction: MessageDirection.INCOMING,
        participants: [],
        attachments: [],
        isDraft: false,
        rawProviderData: replacementMime.rawProviderData,
      } satisfies MessageWithParticipants;
      let emittedUpdateBatch:
        | WorkspaceEventBatch<ObjectRecordUpdateEvent<MessageWorkspaceEntity>>
        | undefined;
      const captureMessageUpdateBatch = (
        batchEvent: WorkspaceEventBatch<
          ObjectRecordUpdateEvent<MessageWorkspaceEntity>
        >,
      ) => {
        if (
          batchEvent.events.some(
            (event) => event.recordId === ingestedMessage.messageId,
          )
        ) {
          emittedUpdateBatch = batchEvent;
        }
      };

      eventEmitter.on('message.updated', captureMessageUpdateBatch);

      try {
        await workspaceOrmManager.executeInWorkspaceContext(
          () =>
            workspaceOrmManager.runInWorkspaceTransaction((transactionScope) =>
              messagingMessageService.saveMessagesWithinTransaction(
                [replacementMessage],
                channel.id,
                transactionScope,
                SEED_APPLE_WORKSPACE_ID,
              ),
            ),
          buildSystemAuthContext(SEED_APPLE_WORKSPACE_ID),
          { lite: true },
        );
      } finally {
        eventEmitter.removeListener(
          'message.updated',
          captureMessageUpdateBatch,
        );
      }

      const defaultRestResponse = await makeRestApiRequest({
        method: 'get',
        path: `/messages/${ingestedMessage.messageId}`,
      });

      expect(defaultRestResponse.status).toBe(200);
      expect(defaultRestResponse.body.data.message.rawProviderData).toEqual(
        replacementMime.rawProviderData,
      );

      if (!isDefined(emittedUpdateBatch)) {
        throw new Error('Message update event was not emitted');
      }

      const updateEvent = emittedUpdateBatch.events.find(
        (event) => event.recordId === ingestedMessage.messageId,
      );

      if (!isDefined(updateEvent)) {
        throw new Error('Message raw update event was not emitted');
      }

      const webhookJobs = transformEventBatchToWebhookEvents({
        workspaceEventBatch: emittedUpdateBatch,
        webhooks: [
          {
            id: uuidv4(),
            targetUrl: 'https://webhook.example.test',
            secret: 'test-secret',
          },
        ],
      });
      const [webhookJob] = webhookJobs;

      if (!isDefined(webhookJob)) {
        throw new Error('Webhook transform returned no event');
      }

      const { secret: _secret, ...outboundWebhookPayload } = webhookJob;
      const oneMiBMeasurements = {
        attachmentBytes,
        mimeBytes: replacementMime.mimeBytes,
        formattedRawJsonBytes: Buffer.byteLength(
          JSON.stringify(replacementMime.rawProviderData),
        ),
        defaultRestResponseBytes: Buffer.byteLength(defaultRestResponse.text),
        emittedUpdateBatchBytes: Buffer.byteLength(
          JSON.stringify(emittedUpdateBatch),
        ),
        webhookPayloadBytes: Buffer.byteLength(
          JSON.stringify(outboundWebhookPayload),
        ),
      };

      expect(oneMiBMeasurements.mimeBytes).toBeGreaterThan(attachmentBytes);
      expect(oneMiBMeasurements.formattedRawJsonBytes).toBeGreaterThan(
        oneMiBMeasurements.mimeBytes,
      );
      expect(oneMiBMeasurements.defaultRestResponseBytes).toBeGreaterThan(
        oneMiBMeasurements.formattedRawJsonBytes,
      );
      expect(oneMiBMeasurements.emittedUpdateBatchBytes).toBeGreaterThan(
        oneMiBMeasurements.formattedRawJsonBytes * 3,
      );
      expect(oneMiBMeasurements.webhookPayloadBytes).toBeGreaterThan(
        oneMiBMeasurements.formattedRawJsonBytes,
      );

      const largeAttachmentBytes = 10 * 1024 * 1024;
      const largeInitialMime = createRawMimeProviderData(
        largeAttachmentBytes,
        0,
      );
      const largeReplacementMime = createRawMimeProviderData(
        largeAttachmentBytes,
        1,
      );
      const largeUpdateEvent: ObjectRecordUpdateEvent<MessageWorkspaceEntity> =
        {
          ...updateEvent,
          properties: {
            ...updateEvent.properties,
            before: {
              ...updateEvent.properties.before,
              rawProviderData: largeInitialMime.rawProviderData,
            },
            after: {
              ...updateEvent.properties.after,
              rawProviderData: largeReplacementMime.rawProviderData,
            },
            diff: {
              ...updateEvent.properties.diff,
              rawProviderData: {
                before: largeInitialMime.rawProviderData,
                after: largeReplacementMime.rawProviderData,
              },
            },
          },
        };
      const largeWorkspaceEventBatch = {
        ...emittedUpdateBatch,
        events: [largeUpdateEvent],
      };
      const largeWebhookJobs = transformEventBatchToWebhookEvents({
        workspaceEventBatch: largeWorkspaceEventBatch,
        webhooks: [
          {
            id: uuidv4(),
            targetUrl: 'https://webhook.example.test',
            secret: 'test-secret',
          },
        ],
      });
      const [largeWebhookJob] = largeWebhookJobs;

      if (!isDefined(largeWebhookJob)) {
        throw new Error('Large webhook transform returned no event');
      }

      const { secret: _largeSecret, ...largeOutboundWebhookPayload } =
        largeWebhookJob;
      const tenMiBMeasurements = {
        attachmentBytes: largeAttachmentBytes,
        mimeBytes: largeReplacementMime.mimeBytes,
        formattedRawJsonBytes: Buffer.byteLength(
          JSON.stringify(largeReplacementMime.rawProviderData),
        ),
        emittedUpdateBatchBytes: Buffer.byteLength(
          JSON.stringify(largeWorkspaceEventBatch),
        ),
        webhookPayloadBytes: Buffer.byteLength(
          JSON.stringify(largeOutboundWebhookPayload),
        ),
      };

      expect(tenMiBMeasurements.mimeBytes).toBeGreaterThan(
        largeAttachmentBytes,
      );
      expect(tenMiBMeasurements.formattedRawJsonBytes).toBeGreaterThan(
        tenMiBMeasurements.mimeBytes,
      );
      expect(tenMiBMeasurements.emittedUpdateBatchBytes).toBeGreaterThan(
        tenMiBMeasurements.formattedRawJsonBytes * 3,
      );
      expect(tenMiBMeasurements.webhookPayloadBytes).toBeGreaterThan(
        tenMiBMeasurements.formattedRawJsonBytes,
      );
      expect(largeWebhookJob.record).toMatchObject({
        rawProviderData: largeReplacementMime.rawProviderData,
      });
    });

    it('keeps the last committed whole payload when redeliveries overlap @custom', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;
      const initialRawProviderData = { providerMessageId: 'initial' };
      const initial = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'concurrent-raw-provider-data',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            rawProviderData: initialRawProviderData,
          }),
        ],
      });

      expect(initial.body.errors).toBeUndefined();

      const [ingestedMessage] = initial.body.data.ingestAppMessages.messages;
      const rawProviderDataUpdates = [
        { providerMessageId: 'concurrent-update-1', payload: 'first' },
        { providerMessageId: 'concurrent-update-2', payload: 'second' },
      ];

      const overlappingUpdates = await Promise.all(
        rawProviderDataUpdates.map((rawProviderData) =>
          ingest({
            messageChannelId: channel.id,
            messages: [
              buildMessage({
                externalId: 'concurrent-raw-provider-data',
                threadExternalId,
                senderHandle: 'candidate@linkedin.test',
                rawProviderData,
              }),
            ],
          }),
        ),
      );

      expect(
        overlappingUpdates.every(({ body }) => body.errors === undefined),
      ).toBe(true);

      const [message] = await globalThis.testDataSource.query(
        `SELECT subject, text, "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      expect(rawProviderDataUpdates).toContainEqual(message.rawProviderData);
      expect(message.subject).toBeNull();
      expect(message.text).toBe('Hi there');
    });

    it('keeps the last successful raw write across concurrent channels @custom', async () => {
      const originalChannel = await createChannelOrThrow({
        handle: `original-${uuidv4()}@linkedin.test`,
      });
      const competingChannel = await createChannelOrThrow({
        handle: `competing-${uuidv4()}@linkedin.test`,
      });
      const threadExternalId = `thread-${uuidv4()}`;
      const originalRawProviderData = { providerMessageId: 'original' };
      const initial = await ingest({
        messageChannelId: originalChannel.id,
        messages: [
          buildMessage({
            externalId: 'cross-channel-race',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            subject: 'Original subject',
            text: 'Original body',
            rawProviderData: originalRawProviderData,
          }),
        ],
      });

      expect(initial.body.errors).toBeUndefined();

      const [ingestedMessage] = initial.body.data.ingestAppMessages.messages;
      const [persistedMessage] = await globalThis.testDataSource.query(
        `SELECT "headerMessageId" FROM "${WORKSPACE_SCHEMA}"."message"
           WHERE id = $1`,
        [ingestedMessage.messageId],
      );
      const workspaceOrmManager =
        getAppProviderByClassName<WorkspaceOrmManager>('WorkspaceOrmManager');
      const messagingMessageService =
        getAppProviderByClassName<MessagingMessageService>(
          'MessagingMessageService',
        );
      const runSave = (
        messageChannelId: string,
        rawProviderData: Record<string, unknown>,
      ) =>
        workspaceOrmManager.executeInWorkspaceContext(
          () =>
            workspaceOrmManager.runInWorkspaceTransaction((transactionScope) =>
              messagingMessageService.saveMessagesWithinTransaction(
                [
                  {
                    externalId: `cross-channel-${messageChannelId}`,
                    headerMessageId: persistedMessage.headerMessageId,
                    subject: 'Changed subject',
                    receivedAt: new Date('2026-01-01T10:00:00.000Z'),
                    text: 'Changed body',
                    isDraft: false,
                    attachments: [],
                    messageThreadExternalId: threadExternalId,
                    direction: MessageDirection.INCOMING,
                    participants: [],
                    rawProviderData,
                  } satisfies MessageWithParticipants,
                ],
                messageChannelId,
                transactionScope,
                SEED_APPLE_WORKSPACE_ID,
              ),
            ),
          buildSystemAuthContext(SEED_APPLE_WORKSPACE_ID),
          { lite: true },
        );

      let releaseFirstUpdate!: () => void;
      let signalFirstUpdate!: () => void;
      const firstUpdateGate = new Promise<void>((resolve) => {
        releaseFirstUpdate = resolve;
      });
      const firstUpdateReached = new Promise<void>((resolve) => {
        signalFirstUpdate = resolve;
      });
      let signalSecondUpdate!: () => void;
      const secondUpdateStarted = new Promise<void>((resolve) => {
        signalSecondUpdate = resolve;
      });
      const originalRunInWorkspaceTransaction =
        workspaceOrmManager.runInWorkspaceTransaction.bind(
          workspaceOrmManager,
        ) as <TData>(
          work: (transactionScope: WorkspaceTransactionScope) => Promise<TData>,
        ) => Promise<TData>;
      let rawProviderUpdateCount = 0;
      const transactionSpy = jest
        .spyOn(workspaceOrmManager, 'runInWorkspaceTransaction')
        .mockImplementation(
          <TData>(
            work: (
              transactionScope: WorkspaceTransactionScope,
            ) => Promise<TData>,
          ) =>
            originalRunInWorkspaceTransaction<TData>(
              async (transactionScope: WorkspaceTransactionScope) => {
                const originalGetRepository =
                  transactionScope.getRepository.bind(
                    transactionScope,
                  ) as WorkspaceTransactionScope['getRepository'];

                transactionScope.getRepository = (<TData extends ObjectLiteral>(
                  objectMetadataName: string,
                  rolePermissionConfig?: Parameters<
                    WorkspaceTransactionScope['getRepository']
                  >[1],
                  repositoryOptions?: Parameters<
                    WorkspaceTransactionScope['getRepository']
                  >[2],
                ): WorkspaceRepository<TData> => {
                  if (objectMetadataName === 'message') {
                    const repository =
                      originalGetRepository<MessageWorkspaceEntity>(
                        objectMetadataName,
                        rolePermissionConfig,
                        repositoryOptions,
                      );
                    const originalUpdateMany =
                      repository.updateMany.bind(repository);

                    repository.updateMany = async (updates) => {
                      const containsRawProviderFields = updates.some(
                        ({ partialEntity }) =>
                          Object.prototype.hasOwnProperty.call(
                            partialEntity,
                            'rawProviderData',
                          ),
                      );

                      if (!containsRawProviderFields) {
                        return originalUpdateMany(updates);
                      }

                      rawProviderUpdateCount += 1;

                      if (rawProviderUpdateCount === 1) {
                        const updateResult = await originalUpdateMany(updates);

                        signalFirstUpdate();
                        await firstUpdateGate;

                        return updateResult;
                      }

                      if (rawProviderUpdateCount === 2) {
                        signalSecondUpdate();
                      }

                      return originalUpdateMany(updates);
                    };

                    return repository as unknown as WorkspaceRepository<TData>;
                  }

                  return originalGetRepository<TData>(
                    objectMetadataName,
                    rolePermissionConfig,
                    repositoryOptions,
                  );
                }) as WorkspaceTransactionScope['getRepository'];

                return work(transactionScope);
              },
            ),
        );
      const delayedCrossChannelWriteOutcome = runSave(competingChannel.id, {
        providerMessageId: 'competing',
      }).then(
        () => ({ status: 'completed' as const }),
        (error: unknown) => ({ status: 'failed' as const, error }),
      );

      try {
        const firstWriteResult = await Promise.race([
          firstUpdateReached.then(() => ({ status: 'reached' as const })),
          delayedCrossChannelWriteOutcome,
        ]);

        if (firstWriteResult.status === 'failed') {
          throw firstWriteResult.error;
        }

        expect(firstWriteResult.status).toBe('reached');
        const secondCrossChannelWriteOutcome = runSave(originalChannel.id, {
          providerMessageId: 'replacement',
        }).then(
          () => ({ status: 'completed' as const }),
          (error: unknown) => ({ status: 'failed' as const, error }),
        );
        const secondWriteResult = await Promise.race([
          secondUpdateStarted.then(() => ({ status: 'reached' as const })),
          secondCrossChannelWriteOutcome,
        ]);

        if (secondWriteResult.status === 'failed') {
          throw secondWriteResult.error;
        }

        expect(secondWriteResult.status).toBe('reached');
        releaseFirstUpdate();

        const [delayedWriteResult, competingWriteResult] = await Promise.all([
          delayedCrossChannelWriteOutcome,
          secondCrossChannelWriteOutcome,
        ]);

        if (delayedWriteResult.status === 'failed') {
          throw delayedWriteResult.error;
        }

        if (competingWriteResult.status === 'failed') {
          throw competingWriteResult.error;
        }
      } finally {
        releaseFirstUpdate();
        transactionSpy.mockRestore();
      }

      const [message] = await globalThis.testDataSource.query(
        `SELECT subject, text, "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      expect(message).toEqual({
        subject: 'Original subject',
        text: 'Original body',
        rawProviderData: { providerMessageId: 'replacement' },
      });
    });

    it('stores a large raw payload without truncation @custom', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;
      const rawProviderData = {
        providerMessageId: 'large-raw-provider-data',
        payload: 'a'.repeat(64 * 1024),
      };
      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'large-raw-provider-data',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            rawProviderData,
          }),
        ],
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();

      const [ingestedMessage] = response.body.data.ingestAppMessages.messages;
      const [message] = await globalThis.testDataSource.query(
        `SELECT "rawProviderData" FROM "${WORKSPACE_SCHEMA}"."message"
          WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      expect(message.rawProviderData).toEqual(rawProviderData);
    });

    it('chunks raw replacements at the repository limit and rolls back a failed later chunk @custom', async () => {
      const sourceChannel = await createChannelOrThrow({
        handle: `source-${uuidv4()}@linkedin.test`,
      });
      const replacementChannel = await createChannelOrThrow({
        handle: `replacement-${uuidv4()}@linkedin.test`,
      });
      const messagePrefix = `bulk-raw-replacement-${uuidv4()}`;
      const messageCount = QUERY_MAX_RECORDS + 1;
      const messages = Array.from({ length: messageCount }, (_, index) => ({
        ...buildMessage({
          externalId: `${messagePrefix}-${index}`,
          threadExternalId: `${messagePrefix}-thread-${index}`,
          senderHandle: 'candidate@linkedin.test',
          subject: `Original subject ${index}`,
          text: `Original body ${index}`,
          rawProviderData: {
            providerMessageId: `${messagePrefix}-original-${index}`,
          },
        }),
      }));
      const messageIds: string[] = [];

      for (
        let batchStart = 0;
        batchStart < messages.length;
        batchStart += INGEST_APP_MESSAGES_MAX_BATCH_SIZE
      ) {
        const response = await ingest({
          messageChannelId: sourceChannel.id,
          messages: messages.slice(
            batchStart,
            batchStart + INGEST_APP_MESSAGES_MAX_BATCH_SIZE,
          ),
        });

        expect(response.body.errors).toBeUndefined();
        messageIds.push(
          ...response.body.data.ingestAppMessages.messages.map(
            ({ messageId }: { messageId: string }) => messageId,
          ),
        );
      }

      const persistedMessages: {
        id: string;
        headerMessageId: string;
        messageThreadId: string;
      }[] = await globalThis.testDataSource.query(
        `SELECT id, "headerMessageId", "messageThreadId"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = ANY($1)`,
        [messageIds],
      );
      const persistedMessagesById = new Map(
        persistedMessages.map((message) => [message.id, message]),
      );
      const replacementMessages = messageIds.map((messageId, index) => {
        const persistedMessage = persistedMessagesById.get(messageId);

        if (!isDefined(persistedMessage)) {
          throw new Error(`Message ${messageId} was not persisted`);
        }

        return {
          externalId: `${messagePrefix}-replacement-${index}`,
          headerMessageId: persistedMessage.headerMessageId,
          subject: `Changed subject ${index}`,
          text: `Changed body ${index}`,
          receivedAt: new Date('2026-01-01T10:00:00.000Z'),
          messageThreadExternalId: `${messagePrefix}-thread-${index}`,
          direction: MessageDirection.INCOMING,
          participants: [],
          attachments: [],
          isDraft: false,
          rawProviderData: {
            providerMessageId: `${messagePrefix}-replacement-${index}`,
          },
        } satisfies MessageWithParticipants;
      });
      const workspaceOrmManager =
        getAppProviderByClassName<WorkspaceOrmManager>('WorkspaceOrmManager');
      const messagingMessageService =
        getAppProviderByClassName<MessagingMessageService>(
          'MessagingMessageService',
        );
      const workspaceEventEmitter =
        getAppProviderByClassName<WorkspaceEventEmitter>(
          'WorkspaceEventEmitter',
        );
      let rawUpdateManyCalls = 0;
      const saveReplacements = (failOnSecondUpdate = false) =>
        workspaceOrmManager.executeInWorkspaceContext(
          () =>
            workspaceOrmManager.runInWorkspaceTransaction(
              async (transactionScope) => {
                if (failOnSecondUpdate) {
                  const originalGetRepository =
                    transactionScope.getRepository.bind(
                      transactionScope,
                    ) as WorkspaceTransactionScope['getRepository'];

                  transactionScope.getRepository = (<
                    TData extends ObjectLiteral,
                  >(
                    objectMetadataName: string,
                    rolePermissionConfig?: Parameters<
                      WorkspaceTransactionScope['getRepository']
                    >[1],
                    repositoryOptions?: Parameters<
                      WorkspaceTransactionScope['getRepository']
                    >[2],
                  ): WorkspaceRepository<TData> => {
                    if (objectMetadataName !== 'message') {
                      return originalGetRepository<TData>(
                        objectMetadataName,
                        rolePermissionConfig,
                        repositoryOptions,
                      );
                    }

                    const repository =
                      originalGetRepository<MessageWorkspaceEntity>(
                        objectMetadataName,
                        rolePermissionConfig,
                        repositoryOptions,
                      );
                    const originalUpdateMany =
                      repository.updateMany.bind(repository);

                    repository.updateMany = async (updates) => {
                      rawUpdateManyCalls += 1;

                      if (rawUpdateManyCalls === 2) {
                        throw new Error('Fail the second raw update chunk');
                      }

                      return originalUpdateMany(updates);
                    };

                    return repository as unknown as WorkspaceRepository<TData>;
                  }) as WorkspaceTransactionScope['getRepository'];
                }

                return messagingMessageService.saveMessagesWithinTransaction(
                  replacementMessages,
                  replacementChannel.id,
                  transactionScope,
                  SEED_APPLE_WORKSPACE_ID,
                );
              },
            ),
          buildSystemAuthContext(SEED_APPLE_WORKSPACE_ID),
          { lite: true },
        );

      const emitDatabaseBatchEvent =
        workspaceEventEmitter.emitDatabaseBatchEvent.bind(
          workspaceEventEmitter,
        );
      const eventSpy = jest
        .spyOn(workspaceEventEmitter, 'emitDatabaseBatchEvent')
        .mockImplementation((event) => emitDatabaseBatchEvent(event));

      try {
        await expect(saveReplacements(true)).rejects.toThrow();
        expect(eventSpy).not.toHaveBeenCalled();
      } finally {
        eventSpy.mockRestore();
      }

      expect(rawUpdateManyCalls).toBe(2);

      const messagesAfterRollback: {
        id: string;
        rawProviderData: Record<string, unknown>;
      }[] = await globalThis.testDataSource.query(
        `SELECT id, "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = ANY($1)`,
        [messageIds],
      );

      expect(messagesAfterRollback).toHaveLength(messageCount);

      for (const [index, messageId] of messageIds.entries()) {
        const message = messagesAfterRollback.find(
          ({ id }) => id === messageId,
        );

        expect(message?.rawProviderData).toEqual({
          providerMessageId: `${messagePrefix}-original-${index}`,
        });
      }

      const saveResult = await saveReplacements();

      expect(saveResult.createdMessages).toHaveLength(0);
      expect(saveResult.messageExternalIdsAndIdsMap.size).toBe(messageCount);
      expect(saveResult.messageExternalIdToMessageThreadIdMap.size).toBe(
        messageCount,
      );

      const updatedMessages: {
        id: string;
        headerMessageId: string;
        messageThreadId: string;
        subject: string;
        text: string;
        rawProviderData: Record<string, unknown>;
      }[] = await globalThis.testDataSource.query(
        `SELECT id, "headerMessageId", "messageThreadId", subject, text,
                "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = ANY($1)`,
        [messageIds],
      );
      const updatedMessagesById = new Map(
        updatedMessages.map((message) => [message.id, message]),
      );
      const associations: {
        id: string;
        messageId: string;
        messageChannelId: string;
        messageExternalId: string;
        messageThreadExternalId: string;
      }[] = await globalThis.testDataSource.query(
        `SELECT id, "messageId", "messageChannelId", "messageExternalId",
                "messageThreadExternalId"
           FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
          WHERE "messageId" = ANY($1)`,
        [messageIds],
      );
      const associationsByMessageId = new Map<string, typeof associations>();

      for (const association of associations) {
        const messageAssociations =
          associationsByMessageId.get(association.messageId) ?? [];

        messageAssociations.push(association);
        associationsByMessageId.set(association.messageId, messageAssociations);
      }

      for (const [index, messageId] of messageIds.entries()) {
        const persistedMessage = persistedMessagesById.get(messageId);
        const updatedMessage = updatedMessagesById.get(messageId);
        const replacement = replacementMessages[index];
        const sourceExternalId = `${messagePrefix}-${index}`;
        const replacementExternalId = `${messagePrefix}-replacement-${index}`;
        const messageAssociations = associationsByMessageId.get(messageId);

        expect(persistedMessage).toBeDefined();
        expect(updatedMessage).toMatchObject({
          id: messageId,
          headerMessageId: persistedMessage?.headerMessageId,
          messageThreadId: persistedMessage?.messageThreadId,
          subject: `Original subject ${index}`,
          text: `Original body ${index}`,
          rawProviderData: replacement.rawProviderData,
        });
        expect(
          saveResult.messageExternalIdsAndIdsMap.get(replacementExternalId),
        ).toBe(messageId);
        expect(
          saveResult.messageExternalIdToMessageThreadIdMap.get(
            replacementExternalId,
          ),
        ).toBe(persistedMessage?.messageThreadId);
        expect(messageAssociations).toHaveLength(2);
        expect(messageAssociations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              messageChannelId: sourceChannel.id,
              messageExternalId: sourceExternalId,
            }),
            expect.objectContaining({
              messageChannelId: replacementChannel.id,
              messageExternalId: replacementExternalId,
              messageThreadExternalId: `${messagePrefix}-thread-${index}`,
            }),
          ]),
        );
        expect(
          saveResult.messageExternalIdToMessageChannelMessageAssociationIdMap.get(
            replacementExternalId,
          ),
        ).toBe(
          messageAssociations?.find(
            ({ messageChannelId }) =>
              messageChannelId === replacementChannel.id,
          )?.id,
        );
      }
    });

    it('preserves raw data on more shared messages when a channel is removed @custom', async () => {
      const sourceChannel = await createChannelOrThrow({
        handle: `source-${uuidv4()}@linkedin.test`,
      });
      const retainedChannel = await createChannelOrThrow({
        handle: `retained-${uuidv4()}@linkedin.test`,
      });
      const messagePrefix = `bulk-cleanup-${uuidv4()}`;
      const messageCount = 201;
      const messages = Array.from({ length: messageCount }, (_, index) => ({
        ...buildMessage({
          externalId: `${messagePrefix}-${index}`,
          threadExternalId: `${messagePrefix}-thread-${index}`,
          senderHandle: sourceChannel.handle,
          subject: `Bulk cleanup ${index}`,
          text: `Body ${index}`,
          rawProviderData: {
            providerMessageId: `${messagePrefix}-${index}`,
          },
        }),
        participants: [
          {
            role: MessageParticipantRole.FROM,
            handle: sourceChannel.handle,
          },
        ],
      }));
      const messageIds: string[] = [];

      for (
        let batchStart = 0;
        batchStart < messages.length;
        batchStart += INGEST_APP_MESSAGES_MAX_BATCH_SIZE
      ) {
        const response = await ingest({
          messageChannelId: sourceChannel.id,
          messages: messages.slice(
            batchStart,
            batchStart + INGEST_APP_MESSAGES_MAX_BATCH_SIZE,
          ),
        });

        expect(response.body.errors).toBeUndefined();
        messageIds.push(
          ...response.body.data.ingestAppMessages.messages.map(
            ({ messageId }: { messageId: string }) => messageId,
          ),
        );
      }

      const authContext = buildSystemAuthContext(SEED_APPLE_WORKSPACE_ID);
      const workspaceOrmManager =
        getAppProviderByClassName<WorkspaceOrmManager>('WorkspaceOrmManager');

      await workspaceOrmManager.executeInWorkspaceContext(
        () =>
          workspaceOrmManager.runInWorkspaceTransaction(async (scope) => {
            await scope
              .getRepository<MessageChannelMessageAssociationWorkspaceEntity>(
                'messageChannelMessageAssociation',
                { shouldBypassPermissionChecks: true },
              )
              .insert(
                messageIds.map((messageId, index) => ({
                  id: uuidv4(),
                  messageId,
                  messageChannelId: retainedChannel.id,
                  messageExternalId: `retained-${index}`,
                  messageThreadExternalId: `retained-thread-${index}`,
                  direction: MessageDirection.INCOMING,
                })),
              );
          }),
        authContext,
        { lite: true },
      );

      const cleaner = getAppProviderByClassName<MessagingMessageCleanerService>(
        'MessagingMessageCleanerService',
      );

      await cleaner.deleteMessageChannelMessageAssociationsByChannelId({
        workspaceId: SEED_APPLE_WORKSPACE_ID,
        messageChannelId: sourceChannel.id,
      });

      const [counts] = await globalThis.testDataSource.query(
        `SELECT
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."message"
             WHERE id = ANY($1)) AS "messageCount",
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
             WHERE "messageId" = ANY($1) AND "messageChannelId" = $2) AS "retainedAssociationCount",
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."messageChannelMessageAssociation"
             WHERE "messageId" = ANY($1) AND "messageChannelId" = $3) AS "sourceAssociationCount",
           (SELECT count(*)::integer FROM "${WORKSPACE_SCHEMA}"."message"
             WHERE id = ANY($1) AND "rawProviderData" IS NOT NULL) AS "rawProviderDataCount"`,
        [messageIds, retainedChannel.id, sourceChannel.id],
      );

      expect(counts).toEqual({
        messageCount,
        retainedAssociationCount: messageCount,
        sourceAssociationCount: 0,
        rawProviderDataCount: messageCount,
      });
    });

    it('rolls back a raw replacement when the message transaction fails @custom', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;
      const initialRawProviderData = { providerMessageId: 'before-failure' };
      const initial = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'rolled-back-raw-provider-data',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
            rawProviderData: initialRawProviderData,
          }),
        ],
      });

      expect(initial.body.errors).toBeUndefined();

      const [ingestedMessage] = initial.body.data.ingestAppMessages.messages;
      const messagingMessageService =
        getAppProviderByClassName<MessagingMessageService>(
          'MessagingMessageService',
        );
      const saveMessagesWithinTransaction =
        messagingMessageService.saveMessagesWithinTransaction.bind(
          messagingMessageService,
        );
      const saveSpy = jest
        .spyOn(messagingMessageService, 'saveMessagesWithinTransaction')
        .mockImplementation(async (...args) => {
          await saveMessagesWithinTransaction(...args);
          throw new Error('Force the message transaction to roll back');
        });
      let failedReplacement: Awaited<ReturnType<typeof ingest>>;

      try {
        failedReplacement = await ingest({
          messageChannelId: channel.id,
          messages: [
            buildMessage({
              externalId: 'rolled-back-raw-provider-data',
              threadExternalId,
              senderHandle: 'candidate@linkedin.test',
              rawProviderData: { providerMessageId: 'must-not-commit' },
            }),
          ],
        });

        expect(saveSpy).toHaveBeenCalledTimes(1);
      } finally {
        saveSpy.mockRestore();
      }

      expect(failedReplacement.body.errors).toBeDefined();

      const [message] = await globalThis.testDataSource.query(
        `SELECT "rawProviderData"
           FROM "${WORKSPACE_SCHEMA}"."message" WHERE id = $1`,
        [ingestedMessage.messageId],
      );

      expect(message).toEqual({
        rawProviderData: initialRawProviderData,
      });
    });

    it('derives direction from the sender, matching the handle case-insensitively', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'sent-by-the-channel-owner',
            threadExternalId,
            // The channel's own handle, spelled the way a provider that upper-cases its profile API returns it.
            senderHandle: CHANNEL_HANDLE.toUpperCase(),
          }),
          buildMessage({
            externalId: 'sent-by-someone-else',
            threadExternalId,
            senderHandle: 'candidate@linkedin.test',
          }),
        ],
      });

      expect(response.body.errors).toBeUndefined();

      const [outgoing, incoming] =
        response.body.data.ingestAppMessages.messages;

      expect(await findAssociation(outgoing.messageId)).toMatchObject({
        direction: MessageDirection.OUTGOING,
        messageExternalId: 'sent-by-the-channel-owner',
      });
      expect(await findAssociation(incoming.messageId)).toMatchObject({
        direction: MessageDirection.INCOMING,
      });
    });

    it('refuses a channel owned by another application', async () => {
      const channel = await createChannelOrThrow();

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'msg-1',
            threadExternalId: 'thread-1',
            senderHandle: 'candidate@linkedin.test',
          }),
        ],
        token: otherApplicationToken,
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    it('refuses a channel whose sync the app turned off', async () => {
      const channel = await createChannelOrThrow();

      await request({
        query: UPDATE_CHANNEL_MUTATION,
        variables: { input: { id: channel.id, isSyncEnabled: false } },
      });

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'msg-1',
            threadExternalId: 'thread-1',
            senderHandle: 'candidate@linkedin.test',
          }),
        ],
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_USER_INPUT',
      );
    });

    it('refuses a message that does not have exactly one sender', async () => {
      const channel = await createChannelOrThrow();

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          {
            ...buildMessage({
              externalId: 'msg-1',
              threadExternalId: 'thread-1',
              senderHandle: 'candidate@linkedin.test',
            }),
            participants: [
              {
                role: MessageParticipantRole.TO,
                handle: 'recruiter@linkedin.test',
                displayName: 'Recruiter',
              },
            ],
          },
        ],
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_USER_INPUT',
      );
    });

    it('refuses a participant pointing at a person that does not exist', async () => {
      const channel = await createChannelOrThrow();

      const response = await ingest({
        messageChannelId: channel.id,
        messages: [
          buildMessage({
            externalId: 'msg-1',
            threadExternalId: 'thread-1',
            senderHandle: 'candidate@linkedin.test',
            personId: uuidv4(),
          }),
        ],
      });

      expect(response.body.errors?.[0]?.extensions?.code).toBe(
        'BAD_USER_INPUT',
      );
    });

    it('refuses a batch larger than the documented maximum', async () => {
      const channel = await createChannelOrThrow();
      const threadExternalId = `thread-${uuidv4()}`;

      const response = await ingest({
        messageChannelId: channel.id,
        messages: Array.from(
          { length: INGEST_APP_MESSAGES_MAX_BATCH_SIZE + 1 },
          (_unused, index) =>
            buildMessage({
              externalId: `msg-${index}`,
              threadExternalId,
              senderHandle: 'candidate@linkedin.test',
            }),
        ),
      });

      expect(response.body.errors).toBeDefined();

      const [{ count }] = await globalThis.testDataSource.query(
        `SELECT count(*) AS count FROM "${WORKSPACE_SCHEMA}"."message"
           WHERE "headerMessageId" LIKE $1`,
        [`app:${owningApplicationDbId}:${channel.id}:%`],
      );

      expect(Number(count)).toBe(0);
    });
  });
});
