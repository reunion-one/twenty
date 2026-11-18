import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { RelationType } from '~/generated-metadata/graphql';
import {
  computeMorphRelationGqlFieldName,
  isDefined,
} from 'twenty-shared/utils';

export const getRelatedRecordFieldsWidgetRecordSources = (
  sourceObject: EnrichedObjectMetadataItem,
  objectMetadataItems: EnrichedObjectMetadataItem[],
) =>
  sourceObject.readableFields
    .filter((field) => field.isActive)
    .flatMap((field) => {
      const relations = isDefined(field.relation)
        ? [field.relation]
        : (field.morphRelations ?? []);
      return relations
        .filter((relation) => relation.type === RelationType.MANY_TO_ONE)
        .flatMap((relation) => {
          const objectMetadataItem = objectMetadataItems.find(
            (object) => object.id === relation.targetObjectMetadata.id,
          );
          if (!isDefined(objectMetadataItem)) return [];
          return [
            {
              fieldMetadataId: relation.sourceFieldMetadata.id,
              label: isDefined(field.relation)
                ? field.label
                : `${field.label} · ${objectMetadataItem.labelSingular}`,
              icon: field.icon,
              fieldName: isDefined(field.relation)
                ? field.name
                : computeMorphRelationGqlFieldName({
                    fieldName: field.name,
                    relationType: relation.type,
                    targetObjectMetadataNameSingular:
                      objectMetadataItem.nameSingular,
                    targetObjectMetadataNamePlural:
                      objectMetadataItem.namePlural,
                  }),
              objectMetadataItem,
            },
          ];
        });
    });
