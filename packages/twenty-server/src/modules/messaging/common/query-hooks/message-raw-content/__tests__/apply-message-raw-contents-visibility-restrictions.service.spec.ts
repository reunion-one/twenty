import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED } from 'twenty-shared/constants';
import {
  MessageChannelVisibility,
  type ObjectRecord,
} from 'twenty-shared/types';
import { In } from 'typeorm';

import { CommonRecordVisibilityService } from 'src/engine/api/common/common-record-visibility/common-record-visibility.service';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { ApplyMessageRawContentsVisibilityRestrictionsService } from 'src/modules/messaging/common/query-hooks/message-raw-content/apply-message-raw-contents-visibility-restrictions.service';

describe('ApplyMessageRawContentsVisibilityRestrictionsService @custom', () => {
  let service: ApplyMessageRawContentsVisibilityRestrictionsService;
  const findRawContents = jest.fn();
  const findAssociations = jest.fn();
  const findChannels = jest.fn();
  const registerHandler = jest.fn();
  const getRepository = jest.fn((objectName: string) => ({
    find:
      objectName === 'messageRawContent' ? findRawContents : findAssociations,
  }));
  const executeInWorkspaceContext = jest.fn(
    async (callback: () => Promise<unknown>) => callback(),
  );
  const userAuthContext = {
    type: 'user',
    workspace: { id: 'workspace' },
    userWorkspaceId: 'viewer',
  } as WorkspaceAuthContext;
  const createRecord = (
    id = 'raw',
    associationId = 'association',
  ): ObjectRecord => ({
    id,
    messageId: 'same-message',
    messageChannelMessageAssociationId: associationId,
    rawContent: 'private headers',
    metadata: { deliveredTo: 'private@example.com' },
    provider: 'gmail',
    contentFormat: 'gmail-email-snapshot-v1',
  });
  const createChannel = (
    visibility = MessageChannelVisibility.METADATA,
    userWorkspaceId = 'other',
    applicationId: string | null = null,
    id = 'channel',
  ) => ({
    id,
    visibility,
    connectedAccount: { userWorkspaceId, applicationId },
  });
  const apply = (records: ObjectRecord[], authContext = userAuthContext) =>
    service.applyVisibilityRestrictions({ records, authContext });

  beforeEach(async () => {
    jest.clearAllMocks();
    findRawContents.mockResolvedValue([]);
    findAssociations.mockResolvedValue([
      { id: 'association', messageChannelId: 'channel' },
    ]);
    findChannels.mockResolvedValue([createChannel()]);
    const module = await Test.createTestingModule({
      providers: [
        ApplyMessageRawContentsVisibilityRestrictionsService,
        {
          provide: WorkspaceOrmManager,
          useValue: { getRepository, executeInWorkspaceContext },
        },
        {
          provide: CommonRecordVisibilityService,
          useValue: { registerHandler },
        },
        {
          provide: getRepositoryToken(MessageChannelEntity),
          useValue: { find: findChannels },
        },
      ],
    }).compile();

    service = module.get(ApplyMessageRawContentsVisibilityRestrictionsService);
  });

  it('registers the raw content handler', () => {
    service.onModuleInit();
    expect(registerHandler).toHaveBeenCalledWith({
      objectNameSingular: 'messageRawContent',
      handler: service,
    });
  });

  it('keeps shared raw content and metadata', async () => {
    findChannels.mockResolvedValue([
      createChannel(MessageChannelVisibility.SHARE_EVERYTHING),
    ]);
    const record = createRecord();
    const original = { ...record };

    await apply([record]);

    expect(record).toEqual(original);
  });

  it.each([
    MessageChannelVisibility.METADATA,
    MessageChannelVisibility.SUBJECT,
  ])('restricts %s while keeping format and provider', async (visibility) => {
    findChannels.mockResolvedValue([createChannel(visibility)]);
    const record = createRecord();

    await apply([record]);

    expect(record).toMatchObject({
      rawContent: FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
      metadata: null,
      provider: 'gmail',
      contentFormat: 'gmail-email-snapshot-v1',
    });
  });

  it('keeps a private copy owned by the viewing user', async () => {
    findChannels.mockResolvedValue([
      createChannel(MessageChannelVisibility.METADATA, 'viewer'),
    ]);
    const record = createRecord();

    await apply([record]);

    expect(record.rawContent).toBe('private headers');
    expect(record.metadata).toEqual({ deliveredTo: 'private@example.com' });
  });

  it.each(['application', 'other', null])(
    'checks application ownership against %s',
    async (applicationId) => {
      findChannels.mockResolvedValue([
        createChannel(
          MessageChannelVisibility.METADATA,
          'viewer',
          applicationId,
        ),
      ]);
      const record = createRecord();
      const authContext = {
        type: 'application',
        workspace: { id: 'workspace' },
        application: { id: 'application' },
      } as WorkspaceAuthContext;

      await apply([record], authContext);

      expect(record.rawContent).toBe(
        applicationId === 'application'
          ? 'private headers'
          : FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
      );
      expect(record.metadata).toEqual(
        applicationId === 'application'
          ? { deliveredTo: 'private@example.com' }
          : null,
      );
    },
  );

  it('does not borrow visibility from another copy of the same message', async () => {
    findAssociations.mockResolvedValue([
      { id: 'shared-association', messageChannelId: 'shared-channel' },
      { id: 'private-association', messageChannelId: 'channel' },
    ]);
    findChannels.mockResolvedValue([
      createChannel(
        MessageChannelVisibility.SHARE_EVERYTHING,
        'other',
        null,
        'shared-channel',
      ),
      createChannel(),
    ]);
    const sharedRecord = createRecord('shared', 'shared-association');
    const privateRecord = createRecord('private', 'private-association');

    await apply([sharedRecord, privateRecord]);

    expect(sharedRecord.rawContent).toBe('private headers');
    expect(sharedRecord.metadata).toEqual({
      deliveredTo: 'private@example.com',
    });
    expect(privateRecord.rawContent).toBe(
      FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
    );
    expect(privateRecord.metadata).toBeNull();
  });

  it('skips all queries without protected keys', async () => {
    await apply([{ id: 'raw', provider: 'gmail', contentFormat: 'snapshot' }]);

    expect(executeInWorkspaceContext).not.toHaveBeenCalled();
    expect(getRepository).not.toHaveBeenCalled();
    expect(findChannels).not.toHaveBeenCalled();
  });

  it('loads the association from the raw row when omitted', async () => {
    const record = createRecord();
    delete record.messageChannelMessageAssociationId;
    findRawContents.mockResolvedValue([
      { id: 'raw', messageChannelMessageAssociationId: 'association' },
    ]);
    findChannels.mockResolvedValue([
      createChannel(MessageChannelVisibility.SHARE_EVERYTHING),
    ]);

    await apply([record]);

    expect(getRepository).toHaveBeenCalledWith('messageRawContent', {
      shouldBypassPermissionChecks: true,
    });
    expect(findRawContents).toHaveBeenCalledWith({
      where: { id: In(['raw']) },
    });
    expect(findAssociations).toHaveBeenCalledWith({
      where: { id: In(['association']) },
    });
    expect(executeInWorkspaceContext).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        type: 'system',
        workspace: { id: 'workspace' },
      }),
      { lite: true },
    );
    expect(record.rawContent).toBe('private headers');
  });

  it.each(['raw', 'association', 'channel'])(
    'restricts an unresolved %s',
    async (missing) => {
      const record = createRecord();
      if (missing === 'raw') {
        delete record.messageChannelMessageAssociationId;
      } else if (missing === 'association') {
        findAssociations.mockResolvedValue([]);
      } else {
        findChannels.mockResolvedValue([]);
      }

      await apply([record]);

      expect(record.rawContent).toBe(
        FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
      );
      expect(record.metadata).toBeNull();
    },
  );

  it.each(['rawContent', 'metadata'])(
    'only restricts the selected %s key',
    async (fieldName) => {
      const record: ObjectRecord = {
        id: 'raw',
        messageChannelMessageAssociationId: 'association',
        [fieldName]: 'secret',
      };

      await apply([record]);

      expect(record).toEqual({
        id: 'raw',
        messageChannelMessageAssociationId: 'association',
        [fieldName]:
          fieldName === 'metadata'
            ? null
            : FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED,
      });
    },
  );
});
