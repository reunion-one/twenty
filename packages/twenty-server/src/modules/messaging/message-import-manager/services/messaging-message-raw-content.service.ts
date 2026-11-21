import { Injectable } from '@nestjs/common';
import { isString } from '@sniptt/guards';
import chunk from 'lodash.chunk';
import isEqual from 'lodash.isequal';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';
import { FeatureFlagKey } from 'twenty-shared/types';
import { isDefined, isPlainObject } from 'twenty-shared/utils';
import { In } from 'typeorm';
import { v4 } from 'uuid';

import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { FILE_REMOTE_ORIGIN_TYPE } from 'src/engine/core-modules/file/types/file-remote-origin-type.type';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type MessageRawContentWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-raw-content.workspace-entity';
import { type MessageRawContentAttachment } from 'src/modules/messaging/common/types/message-raw-content-attachment.type';
import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';
import { type MessageWithParticipants } from 'src/modules/messaging/message-import-manager/types/message.type';

type RawContentRow = Pick<
  MessageRawContentWorkspaceEntity,
  | 'messageId'
  | 'messageChannelMessageAssociationId'
  | 'provider'
  | 'contentFormat'
  | 'rawContent'
  | 'metadata'
  | 'twentyAttachments'
>;

type MappingAttachment = {
  attachmentId: string;
  messageId: string;
  file: Pick<FileEntity, 'id' | 'size' | 'remoteOrigin'>;
};

type ExternalizedPart = {
  partPath: string;
  mimePartId: string;
  filename: unknown;
  sizeBytes: unknown;
};

@Injectable()
export class MessagingMessageRawContentService {
  constructor(
    @InjectWorkspaceScopedRepository(FileEntity)
    private readonly fileRepository: WorkspaceScopedRepository<FileEntity>,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async saveMessageRawContents({
    messages,
    messageExternalIdsAndIdsMap,
    messageExternalIdToMessageChannelMessageAssociationIdMap,
    transactionScope,
  }: {
    messages: MessageWithParticipants[];
    messageExternalIdsAndIdsMap: Map<string, string>;
    messageExternalIdToMessageChannelMessageAssociationIdMap: Map<
      string,
      string
    >;
    transactionScope: WorkspaceTransactionScope;
  }): Promise<void> {
    const inputsByAssociationId = new Map<
      string,
      { message: MessageWithParticipants; row: RawContentRow }
    >();

    for (const message of messages) {
      const messageId = messageExternalIdsAndIdsMap.get(message.externalId);
      const associationId =
        messageExternalIdToMessageChannelMessageAssociationIdMap.get(
          message.externalId,
        );

      if (
        !isDefined(message.rawContent) ||
        !isDefined(messageId) ||
        !isDefined(associationId)
      ) {
        continue;
      }

      inputsByAssociationId.set(associationId, {
        message,
        row: {
          messageId,
          messageChannelMessageAssociationId: associationId,
          provider: message.rawContent.provider,
          contentFormat: message.rawContent.contentFormat,
          rawContent: message.rawContent.content,
          metadata: message.rawContent.metadata,
          twentyAttachments: [],
        },
      });
    }

    if (inputsByAssociationId.size === 0) {
      return;
    }

    const inputs = [...inputsByAssociationId.values()];
    const gmailInputs = inputs.filter(
      ({ row }) =>
        row.provider === 'gmail' &&
        row.contentFormat === GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
    );
    const attachments =
      gmailInputs.length > 0 &&
      (await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IS_MESSAGE_ATTACHMENT_ENABLED,
        transactionScope.workspaceId,
      ))
        ? await this.loadAttachments(
            gmailInputs.map(({ row }) => row.messageId),
            transactionScope,
          )
        : [];

    for (const { message, row } of gmailInputs) {
      if (isString(row.rawContent)) {
        row.twentyAttachments = this.buildTwentyAttachments(
          row.rawContent,
          message,
          row.messageChannelMessageAssociationId,
          attachments.filter(({ messageId }) => messageId === row.messageId),
        );
      }
    }

    const repository =
      transactionScope.getRepositoryWithoutPermissionChecks<MessageRawContentWorkspaceEntity>(
        'messageRawContent',
      );
    const existingRows = await repository.find({
      where: {
        messageChannelMessageAssociationId: In([
          ...inputsByAssociationId.keys(),
        ]),
      },
    });
    const existingByAssociationId = new Map(
      existingRows.map((row) => [row.messageChannelMessageAssociationId, row]),
    );
    const rowsToInsert = [];
    const rowsToUpdate = [];

    for (const { row } of inputs) {
      const existing = existingByAssociationId.get(
        row.messageChannelMessageAssociationId,
      );

      if (!isDefined(existing)) {
        rowsToInsert.push({ id: v4(), ...row });
      } else if (
        existing.messageId !== row.messageId ||
        existing.provider !== row.provider ||
        existing.contentFormat !== row.contentFormat ||
        existing.rawContent !== row.rawContent ||
        !isEqual(existing.metadata, row.metadata) ||
        !isEqual(existing.twentyAttachments, row.twentyAttachments)
      ) {
        rowsToUpdate.push({ criteria: existing.id, partialEntity: row });
      }
    }

    if (rowsToInsert.length > 0) {
      await repository.insert(rowsToInsert);
    }

    for (const updates of chunk(rowsToUpdate, QUERY_MAX_RECORDS)) {
      await repository.updateMany(updates);
    }
  }

  private async loadAttachments(
    messageIds: string[],
    transactionScope: WorkspaceTransactionScope,
  ): Promise<MappingAttachment[]> {
    const attachments = await transactionScope
      .getRepositoryWithoutPermissionChecks<AttachmentWorkspaceEntity>(
        'attachment',
      )
      .find({
        where: { targetMessageId: In([...new Set(messageIds)]) },
        select: { id: true, targetMessageId: true, file: true },
        order: { id: 'ASC' },
      });
    const fileIds = attachments.flatMap(({ file }) =>
      (file ?? []).map(({ fileId }) => fileId),
    );

    if (fileIds.length === 0) {
      return [];
    }

    const files = await this.fileRepository.find(transactionScope.workspaceId, {
      where: { id: In([...new Set(fileIds)]) },
      select: { id: true, size: true, remoteOrigin: true },
    });
    const filesById = new Map(files.map((file) => [file.id, file]));

    return attachments
      .flatMap((attachment) =>
        (attachment.file ?? []).flatMap(({ fileId }) => {
          const file = filesById.get(fileId);

          return isDefined(file) && isDefined(attachment.targetMessageId)
            ? [
                {
                  attachmentId: attachment.id,
                  messageId: attachment.targetMessageId,
                  file,
                },
              ]
            : [];
        }),
      )
      .sort(
        (first, second) =>
          first.attachmentId.localeCompare(second.attachmentId) ||
          first.file.id.localeCompare(second.file.id),
      );
  }

  private buildTwentyAttachments(
    content: string,
    message: MessageWithParticipants,
    associationId: string,
    attachments: MappingAttachment[],
  ): MessageRawContentAttachment[] {
    if (attachments.length === 0) {
      return [];
    }

    const snapshot: unknown = JSON.parse(content);

    if (
      !isPlainObject(snapshot) ||
      snapshot.schema !== 'email-semantic-snapshot' ||
      snapshot.schema_version !== 1 ||
      !isPlainObject(snapshot.mime)
    ) {
      return [];
    }

    const nodes: ExternalizedPart[] = [];
    const visit = (node: Record<string, unknown>) => {
      if (node.externalized === true) {
        if (isString(node.part_path) && isString(node.mime_part_id)) {
          nodes.push({
            partPath: node.part_path,
            mimePartId: node.mime_part_id,
            filename: node.filename,
            sizeBytes: node.size_bytes,
          });
        }

        return;
      }

      if (Array.isArray(node.parts)) {
        node.parts.filter(isPlainObject).forEach(visit);
      }
    };

    visit(snapshot.mime);

    const mappings = new Map<ExternalizedPart, MessageRawContentAttachment[]>();
    const remoteAttachmentsByPartId = new Map<string, MappingAttachment[]>();

    for (const attachment of attachments) {
      const origin = attachment.file.remoteOrigin;

      if (
        origin?.originType !== FILE_REMOTE_ORIGIN_TYPE.MESSAGE ||
        !isString(origin.originKey)
      ) {
        continue;
      }

      const candidates = remoteAttachmentsByPartId.get(origin.originKey) ?? [];

      candidates.push(attachment);
      remoteAttachmentsByPartId.set(origin.originKey, candidates);
    }

    for (const [partId, candidates] of remoteAttachmentsByPartId) {
      const associationMatches = candidates.filter(
        ({ file }) => file.remoteOrigin?.originId === associationId,
      );
      const selected =
        associationMatches.length > 0 ? associationMatches : candidates;
      const exact = nodes.find((node) => node.mimePartId === partId);
      const ancestor =
        exact ??
        nodes
          .filter((node) => partId.startsWith(`${node.mimePartId}.`))
          .sort(
            (first, second) =>
              second.mimePartId.length - first.mimePartId.length,
          )[0];

      if (!isDefined(ancestor)) {
        continue;
      }

      const entries = mappings.get(ancestor) ?? [];

      for (const { attachmentId, file } of selected) {
        entries.push({
          partPath: ancestor.partPath,
          mimePartId: partId,
          attachmentId,
          fileId: file.id,
          match: !isDefined(exact)
            ? 'ancestor'
            : file.remoteOrigin?.originId === associationId
              ? 'association'
              : 'message',
        });
      }

      mappings.set(ancestor, entries);
    }

    let nextNodeIndex = 0;

    for (const { fileId, label } of message.attachmentFiles ?? []) {
      const attachment = attachments.find(
        ({ file }) => file.id === fileId && !isDefined(file.remoteOrigin),
      );

      if (!isDefined(attachment)) {
        continue;
      }

      const nodeIndex = nodes.findIndex(
        (node, index) =>
          index >= nextNodeIndex &&
          !mappings.has(node) &&
          node.filename === label &&
          node.sizeBytes === attachment.file.size,
      );
      const node = nodes[nodeIndex];

      if (!isDefined(node)) {
        continue;
      }

      mappings.set(node, [
        {
          partPath: node.partPath,
          mimePartId: node.mimePartId,
          attachmentId: attachment.attachmentId,
          fileId,
          match: 'sent',
        },
      ]);
      nextNodeIndex = nodeIndex + 1;
    }

    return nodes.flatMap((node) => mappings.get(node) ?? []);
  }
}
