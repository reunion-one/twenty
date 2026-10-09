import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { isObjectMetadataReadOnly } from '@/object-record/read-only/utils/isObjectMetadataReadOnly';
import { type ActivityTargetableObject } from '@/activities/types/ActivityTargetableEntity';
import { useCanUpdateObjectRecords } from '@/object-record/hooks/useCanUpdateObjectRecords';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { PermissionFlagType } from '~/generated-metadata/graphql';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';

export const canUploadAttachmentFiles = ({
  targetObjectMetadataItem,
  canUpdateObjectRecords,
  hasUploadPermission,
}: {
  targetObjectMetadataItem: EnrichedObjectMetadataItem;
  canUpdateObjectRecords: boolean;
  hasUploadPermission: boolean;
}) =>
  canUpdateObjectRecords &&
  hasUploadPermission &&
  !isObjectMetadataReadOnly({ objectMetadataItem: targetObjectMetadataItem });

export const useCanUploadAttachmentFiles = (
  targetableObject: ActivityTargetableObject,
) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetableObject.targetObjectNameSingular,
  });
  const { canUpdateObjectRecords } = useCanUpdateObjectRecords(
    targetableObject.targetObjectNameSingular,
  );

  const hasUploadPermission = useHasPermissionFlag(
    PermissionFlagType.UPLOAD_FILE,
  );

  return {
    canUploadFiles: canUploadAttachmentFiles({
      targetObjectMetadataItem: objectMetadataItem,
      canUpdateObjectRecords,
      hasUploadPermission,
    }),
  };
};
