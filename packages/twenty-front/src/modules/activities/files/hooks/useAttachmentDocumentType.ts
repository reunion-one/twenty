import { useEffect, useMemo } from 'react';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { FieldMetadataType } from '~/generated-metadata/graphql';

let hasWarnedAboutInvalidDocumentType = false;

export const useAttachmentDocumentType = () => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.Attachment,
  });
  const objectPermissions = useObjectPermissionsForObject(
    objectMetadataItem.id,
  );

  const fieldMetadata = objectMetadataItem.fields.find(
    (field) => field.name === 'docType',
  );
  const selectFieldMetadata =
    fieldMetadata?.type === FieldMetadataType.SELECT &&
    fieldMetadata.isActive !== false
      ? fieldMetadata
      : undefined;
  const isSelectField = selectFieldMetadata !== undefined;

  const { canReadField, canUpdateField } = selectFieldMetadata
    ? getFieldPermissions({
        objectPermissions,
        fieldMetadataId: selectFieldMetadata.id,
      })
    : { canReadField: false, canUpdateField: false };

  const options = useMemo(
    () =>
      isSelectField && canReadField
        ? [...(selectFieldMetadata.options ?? [])]
            .sort((optionA, optionB) => optionA.position - optionB.position)
            .map(({ value, label, color }) => ({ value, label, color }))
        : [],
    [canReadField, isSelectField, selectFieldMetadata],
  );

  useEffect(() => {
    if (isSelectField || hasWarnedAboutInvalidDocumentType) {
      return;
    }

    hasWarnedAboutInvalidDocumentType = true;
    // Metadata is repaired in the workspace, so this should not interrupt rendering.
    // oxlint-disable-next-line no-console
    console.warn(
      'Attachment docType metadata is missing, inactive, or not a SELECT field.',
    );
  }, [isSelectField]);

  return {
    hasFieldMetadata: selectFieldMetadata !== undefined,
    isSelectField,
    isReadableSelectField: isSelectField && canReadField,
    canReadField,
    canUpdateField,
    isNullable: selectFieldMetadata?.isNullable === true,
    label: canReadField ? selectFieldMetadata?.label : undefined,
    icon: canReadField ? selectFieldMetadata?.icon : undefined,
    options,
  };
};
