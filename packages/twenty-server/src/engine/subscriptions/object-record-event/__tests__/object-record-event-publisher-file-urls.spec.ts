import { Test } from '@nestjs/testing';

import { type ObjectRecordEvent } from 'twenty-shared/database-events';
import { FieldMetadataType } from 'twenty-shared/types';

import { ProcessNestedRelationsHelper } from 'src/engine/api/common/common-nested-relations-processor/process-nested-relations.helper';
import { CommonResultGettersService } from 'src/engine/api/common/common-result-getters/common-result-getters.service';
import { CommonSelectFieldsBuilder } from 'src/engine/api/common/common-select-fields/common-select-fields-builder';
import { FileUrlService } from 'src/engine/core-modules/file/file-url/file-url.service';
import { UserWorkspaceAuthContextService } from 'src/engine/core-modules/user-workspace/services/user-workspace-auth-context.service';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { ATTACHMENT_FLAT_OBJECT_MOCK } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/attachment-flat-object.mock';
import { RecordEventPermissionsReadService } from 'src/engine/permissions/record-event-permissions-read.service';
import { EventStreamService } from 'src/engine/subscriptions/event-stream.service';
import { ObjectRecordEventPublisher } from 'src/engine/subscriptions/object-record-event/object-record-event-publisher';
import { SubscriptionService } from 'src/engine/subscriptions/subscription.service';
import { type EventStreamPayload } from 'src/engine/subscriptions/types/event-stream-payload.type';
import { type EventStreamData } from 'src/engine/subscriptions/types/event-stream-data.type';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

jest.mock(
  'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser',
  () => ({
    GraphqlQueryParser: jest.fn().mockImplementation(() => ({
      parseSelectedFields: jest
        .fn()
        .mockReturnValue({ relations: {}, select: {} }),
    })),
  }),
);

describe('ObjectRecordEventPublisher file urls @custom', () => {
  const workspaceId = ATTACHMENT_FLAT_OBJECT_MOCK.workspaceId;
  const fileField = getFlatFieldMetadataMock({
    objectMetadataId: ATTACHMENT_FLAT_OBJECT_MOCK.id,
    universalIdentifier: 'attachment-file',
    type: FieldMetadataType.FILES,
    name: 'file',
    workspaceId,
  });
  const objectMetadata = {
    ...ATTACHMENT_FLAT_OBJECT_MOCK,
    fieldIds: [fileField.id],
  };
  const metadataMaps = {
    flatObjectMetadataMaps: addFlatEntityToFlatEntityMapsOrThrow({
      flatEntity: objectMetadata,
      flatEntityMaps: createEmptyFlatEntityMaps(),
    }),
    flatFieldMetadataMaps: addFlatEntityToFlatEntityMapsOrThrow({
      flatEntity: fileField,
      flatEntityMaps: createEmptyFlatEntityMaps(),
    }),
  };
  const streamData: EventStreamData = {
    authContext: {
      userWorkspaceId: 'user-workspace',
      workspaceMemberId: 'workspace-member',
    },
    workspaceId,
    queries: {
      'query-1': { objectNameSingular: 'attachment', variables: {} },
    },
    createdAt: Date.now(),
  };
  const publishToEventStream = jest.fn<
    ReturnType<SubscriptionService['publishToEventStream']>,
    Parameters<SubscriptionService['publishToEventStream']>
  >();
  const signFileByIdUrl = jest
    .fn()
    .mockImplementation(
      async ({ fileId }: { fileId: string }) => `signed://${fileId}`,
    );
  let publisher: ObjectRecordEventPublisher;
  let eventBatch: WorkspaceEventBatch<ObjectRecordEvent>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ObjectRecordEventPublisher,
        CommonResultGettersService,
        { provide: FileUrlService, useValue: { signFileByIdUrl } },
        { provide: SubscriptionService, useValue: { publishToEventStream } },
        {
          provide: EventStreamService,
          useValue: {
            getActiveStreamIds: jest.fn().mockResolvedValue(['stream-1']),
            getStreamsData: jest
              .fn()
              .mockResolvedValue(new Map([['stream-1', streamData]])),
            removeFromActiveStreams: jest.fn(),
          },
        },
        {
          provide: WorkspaceCacheService,
          useValue: {
            getOrRecompute: jest.fn().mockResolvedValue({
              ...metadataMaps,
              flatFieldMetadataOptionMaps: createEmptyFlatEntityMaps(),
              flatWorkspaceMemberMaps: { byId: {} },
            }),
          },
        },
        {
          provide: RecordEventPermissionsReadService,
          useValue: {
            filterReadableEvents: jest
              .fn()
              .mockImplementation(
                async ({
                  eventBatch,
                }: {
                  eventBatch: WorkspaceEventBatch<ObjectRecordEvent>;
                }) => eventBatch.events,
              ),
          },
        },
        {
          provide: WorkspaceManyOrAllFlatEntityMapsCacheService,
          useValue: {
            getOrRecomputeManyOrAllFlatEntityMaps: jest
              .fn()
              .mockResolvedValue(metadataMaps),
          },
        },
        {
          provide: CommonSelectFieldsBuilder,
          useValue: {
            findObjectSelectionMetadataIdsOrThrow: jest.fn().mockResolvedValue({
              readableObjectMetadataIds: [],
              unreadableFieldMetadataIds: [],
            }),
            buildFromDepth: jest.fn().mockReturnValue({ selectedFields: {} }),
          },
        },
        {
          provide: ProcessNestedRelationsHelper,
          useValue: { processNestedRelations: jest.fn() },
        },
        {
          provide: WorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest
              .fn()
              .mockImplementation(async (callback: () => Promise<void>) =>
                callback(),
              ),
          },
        },
        {
          provide: UserWorkspaceAuthContextService,
          useValue: { resolve: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    publisher = module.get(ObjectRecordEventPublisher);
    eventBatch = {
      workspaceId,
      objectMetadata,
      name: 'attachment.created',
      events: [
        {
          recordId: 'attachment-1',
          properties: {
            after: {
              id: 'attachment-1',
              file: [{ fileId: 'f1', label: 'Document', extension: 'pdf' }],
            },
          },
        },
      ],
    };
  });

  it('publishes signed file URLs in the event payload', async () => {
    await publisher.publish(eventBatch);

    expect(publishToEventStream).toHaveBeenCalledTimes(1);
    expect(
      (publishToEventStream.mock.calls[0][0].payload as EventStreamPayload)
        .objectRecordEventsWithQueryIds[0].objectRecordEvent.properties,
    ).toMatchObject({
      after: { file: [{ url: 'signed://f1' }] },
    });
  });

  it('still publishes when enrichment throws', async () => {
    signFileByIdUrl.mockRejectedValueOnce(new Error('Signing failed'));

    await publisher.publish(eventBatch);

    expect(signFileByIdUrl).toHaveBeenCalled();
    expect(publishToEventStream).toHaveBeenCalledTimes(1);
    const publishedProperties = (
      publishToEventStream.mock.calls[0][0].payload as EventStreamPayload
    ).objectRecordEventsWithQueryIds[0].objectRecordEvent.properties;

    expect(publishedProperties).toHaveProperty('after.file.0', {
      fileId: 'f1',
      label: 'Document',
      extension: 'pdf',
    });
    expect(publishedProperties).not.toHaveProperty('after.file.0.url');
  });
});
