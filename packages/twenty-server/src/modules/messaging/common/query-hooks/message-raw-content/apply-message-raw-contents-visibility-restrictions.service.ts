import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED } from 'twenty-shared/constants';
import { type ObjectRecord } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { In, Repository } from 'typeorm';

import { CommonRecordVisibilityService } from 'src/engine/api/common/common-record-visibility/common-record-visibility.service';
import { type RecordVisibilityRestrictionHandler } from 'src/engine/api/common/common-record-visibility/types/record-visibility-restriction-handler.type';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { MessageChannelEntity } from 'src/engine/metadata-modules/message-channel/entities/message-channel.entity';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { isMessageChannelFullyVisibleToViewer } from 'src/modules/messaging/common/query-hooks/message/utils/is-message-channel-fully-visible-to-viewer.util';
import { type MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel-message-association.workspace-entity';
import { type MessageRawContentWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-raw-content.workspace-entity';

@Injectable()
export class ApplyMessageRawContentsVisibilityRestrictionsService
  implements RecordVisibilityRestrictionHandler, OnModuleInit
{
  constructor(
    private readonly workspaceOrmManager: WorkspaceOrmManager,
    private readonly commonRecordVisibilityService: CommonRecordVisibilityService,
    @InjectRepository(MessageChannelEntity)
    private readonly messageChannelRepository: Repository<MessageChannelEntity>,
  ) {}

  onModuleInit() {
    this.commonRecordVisibilityService.registerHandler({
      objectNameSingular: 'messageRawContent',
      handler: this,
    });
  }

  public async applyVisibilityRestrictions({
    records,
    authContext,
  }: {
    records: ObjectRecord[];
    authContext: WorkspaceAuthContext;
  }): Promise<void> {
    const restrictableRecords = records.filter(
      (record) => 'rawContent' in record || 'metadata' in record,
    );

    if (restrictableRecords.length === 0) {
      return;
    }

    const workspaceId = authContext.workspace.id;
    const associationIdByRecordId = new Map(
      restrictableRecords.map((record) => [
        record.id,
        record.messageChannelMessageAssociationId,
      ]),
    );
    const unresolvedRecordIds = restrictableRecords
      .filter((record) => !isDefined(record.messageChannelMessageAssociationId))
      .map((record) => record.id)
      .filter(isDefined);

    if (unresolvedRecordIds.length > 0) {
      const rawContents =
        await this.workspaceOrmManager.executeInWorkspaceContext(
          async () =>
            this.workspaceOrmManager
              .getRepository<MessageRawContentWorkspaceEntity>(
                'messageRawContent',
                {
                  shouldBypassPermissionChecks: true,
                },
              )
              .find({ where: { id: In(unresolvedRecordIds) } }),
          buildSystemAuthContext(workspaceId),
          { lite: true },
        );

      for (const rawContent of rawContents) {
        associationIdByRecordId.set(
          rawContent.id,
          rawContent.messageChannelMessageAssociationId,
        );
      }
    }

    const associationIds = [
      ...new Set(associationIdByRecordId.values()),
    ].filter(isDefined);
    const visibleAssociationIds = new Set<string>();

    if (associationIds.length > 0) {
      const associations =
        await this.workspaceOrmManager.executeInWorkspaceContext(
          async () =>
            this.workspaceOrmManager
              .getRepository<MessageChannelMessageAssociationWorkspaceEntity>(
                'messageChannelMessageAssociation',
                { shouldBypassPermissionChecks: true },
              )
              .find({ where: { id: In(associationIds) } }),
          buildSystemAuthContext(workspaceId),
          { lite: true },
        );
      const messageChannelIds = [
        ...new Set(
          associations.map((association) => association.messageChannelId),
        ),
      ].filter(isDefined);

      if (messageChannelIds.length > 0) {
        const messageChannels = await this.messageChannelRepository.find({
          where: { id: In(messageChannelIds), workspaceId },
          select: {
            id: true,
            visibility: true,
            connectedAccount: {
              id: true,
              userWorkspaceId: true,
              applicationId: true,
            },
          },
          relations: { connectedAccount: true },
        });
        const visibleChannelIds = new Set(
          messageChannels
            .filter((messageChannel) =>
              isMessageChannelFullyVisibleToViewer({
                messageChannel,
                authContext,
              }),
            )
            .map((messageChannel) => messageChannel.id),
        );

        for (const association of associations) {
          if (visibleChannelIds.has(association.messageChannelId)) {
            visibleAssociationIds.add(association.id);
          }
        }
      }
    }

    for (const record of restrictableRecords) {
      if (visibleAssociationIds.has(associationIdByRecordId.get(record.id))) {
        continue;
      }

      if ('rawContent' in record) {
        record.rawContent = FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED;
      }
      if ('metadata' in record) {
        record.metadata = null;
      }
    }
  }
}
