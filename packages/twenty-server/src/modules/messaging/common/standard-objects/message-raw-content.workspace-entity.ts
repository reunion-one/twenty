import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type MessageWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message.workspace-entity';
import { type MessageChannelMessageAssociationWorkspaceEntity } from 'src/modules/messaging/common/standard-objects/message-channel-message-association.workspace-entity';

export class MessageRawContentWorkspaceEntity extends BaseWorkspaceEntity {
  message: EntityRelation<MessageWorkspaceEntity>;
  messageId: string;
  messageChannelMessageAssociation: EntityRelation<MessageChannelMessageAssociationWorkspaceEntity>;
  messageChannelMessageAssociationId: string;
  provider: string | null;
  contentFormat: string | null;
  rawContent: string | null;
  metadata: Record<string, unknown> | null;
}
