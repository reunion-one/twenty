import { type FieldWidgetJunctionConfig } from '@/page-layout/widgets/field/utils/resolveFieldWidgetJunctionConfig';
import { isDefined } from 'twenty-shared/utils';

type ResolveFieldWidgetRelationTableObjectMetadataIdArgs = {
  relationObjectMetadataId: string | undefined;
  junctionConfig?: FieldWidgetJunctionConfig | null;
  viewObjectMetadataId?: string;
  nestedRelationFieldMetadataId?: string | null;
  nestedRelationTargetObjectMetadataId?: string;
};

export const resolveFieldWidgetRelationTableObjectMetadataId = ({
  relationObjectMetadataId,
  junctionConfig,
  viewObjectMetadataId,
  nestedRelationFieldMetadataId,
  nestedRelationTargetObjectMetadataId,
}: ResolveFieldWidgetRelationTableObjectMetadataIdArgs): string | undefined => {
  if (isDefined(junctionConfig) && !junctionConfig.isValid) {
    return undefined;
  }

  if (isDefined(nestedRelationFieldMetadataId)) {
    return nestedRelationTargetObjectMetadataId;
  }

  const junctionTargetObjectMetadataId =
    isDefined(junctionConfig) && !junctionConfig.isMorphRelation
      ? junctionConfig.targetFields[0]?.relation?.targetObjectMetadata.id
      : undefined;

  const tableObjectMetadataId =
    viewObjectMetadataId === relationObjectMetadataId
      ? relationObjectMetadataId
      : (junctionTargetObjectMetadataId ?? relationObjectMetadataId);

  return isDefined(viewObjectMetadataId) &&
    viewObjectMetadataId !== tableObjectMetadataId
    ? undefined
    : tableObjectMetadataId;
};
