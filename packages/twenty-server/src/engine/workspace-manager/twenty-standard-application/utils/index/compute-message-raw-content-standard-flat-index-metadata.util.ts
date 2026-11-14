import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type AllStandardObjectIndexName } from 'src/engine/workspace-manager/twenty-standard-application/types/all-standard-object-index-name.type';
import {
  type CreateStandardIndexArgs,
  createStandardIndexFlatMetadata,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/index/create-standard-index-flat-metadata.util';

export const buildMessageRawContentStandardFlatIndexMetadatas = ({
  now,
  objectName,
  workspaceId,
  standardObjectMetadataRelatedEntityIds,
  dependencyFlatEntityMaps,
  twentyStandardApplicationId,
}: Omit<CreateStandardIndexArgs<'messageRawContent'>, 'context'>): Record<
  AllStandardObjectIndexName<'messageRawContent'>,
  FlatIndexMetadata
> => ({
  messageIdIndex: createStandardIndexFlatMetadata({
    objectName,
    workspaceId,
    context: {
      indexName: 'messageIdIndex',
      relatedFieldNames: ['message'],
    },
    standardObjectMetadataRelatedEntityIds,
    dependencyFlatEntityMaps,
    twentyStandardApplicationId,
    now,
  }),
  messageChannelMessageAssociationIdUniqueIndex:
    createStandardIndexFlatMetadata({
      objectName,
      workspaceId,
      context: {
        indexName: 'messageChannelMessageAssociationIdUniqueIndex',
        relatedFieldNames: ['messageChannelMessageAssociation'],
        isUnique: true,
      },
      standardObjectMetadataRelatedEntityIds,
      dependencyFlatEntityMaps,
      twentyStandardApplicationId,
      now,
    }),
});
