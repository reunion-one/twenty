import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { getObjectPermissionsForObject } from '@/object-metadata/utils/getObjectPermissionsForObject';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useIsRecordReadOnly } from '@/object-record/read-only/hooks/useIsRecordReadOnly';
import { recordFieldListHoverPositionComponentState } from '@/object-record/record-field-list/states/recordFieldListHoverPositionComponentState';
import { useRecordShowContainerActions } from '@/object-record/record-show/hooks/useRecordShowContainerActions';
import { useRecordShowContainerData } from '@/object-record/record-show/hooks/useRecordShowContainerData';
import { useRecordRestrictedFieldNames } from '@/object-record/record-store/hooks/useRecordRestrictedFieldNames';
import { RelatedRecordFieldsWidgetFieldItem } from '@/page-layout/widgets/related-record-fields/components/RelatedRecordFieldsWidgetFieldItem';
import { type FieldsWidgetGroupField } from '@/page-layout/widgets/fields/types/FieldsWidgetGroup';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';

type RelatedRecordFieldsWidgetFieldListProps = {
  fields: FieldsWidgetGroupField[];
  instanceId: string;
  isReadOnly: boolean;
};

export const RelatedRecordFieldsWidgetFieldList = ({
  fields,
  instanceId,
  isReadOnly,
}: RelatedRecordFieldsWidgetFieldListProps) => {
  const targetRecord = useTargetRecord();

  const { recordLoading } = useRecordShowContainerData({
    objectRecordId: targetRecord.id,
  });

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const { objectMetadataItems } = useObjectMetadataItems();

  const { useUpdateOneObjectRecordMutation } = useRecordShowContainerActions({
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const restrictedFieldNames = useRecordRestrictedFieldNames(targetRecord.id);

  const isRecordReadOnly = useIsRecordReadOnly({
    recordId: targetRecord.id,
    objectMetadataId: objectMetadataItem.id,
  });

  const setRecordFieldListHoverPosition = useSetAtomComponentState(
    recordFieldListHoverPositionComponentState,
    instanceId,
  );

  const objectPermissions = getObjectPermissionsForObject(
    objectPermissionsByObjectMetadataId,
    objectMetadataItem.id,
  );
  const nonReadableFieldNames = fields
    .filter(
      ({ fieldMetadataItem }) =>
        !objectPermissions.canReadObjectRecords ||
        !getFieldPermissions({
          objectPermissions,
          fieldMetadataId: fieldMetadataItem.id,
        }).canReadField,
    )
    .map(({ fieldMetadataItem }) => fieldMetadataItem.name);

  return fields.map(({ fieldMetadataItem, globalIndex }) => (
    <RelatedRecordFieldsWidgetFieldItem
      key={targetRecord.id + fieldMetadataItem.id}
      fieldMetadataItem={fieldMetadataItem}
      globalIndex={globalIndex}
      recordId={targetRecord.id}
      restrictedFieldNames={[...restrictedFieldNames, ...nonReadableFieldNames]}
      objectMetadataItem={objectMetadataItem}
      objectMetadataItems={objectMetadataItems}
      objectPermissionsByObjectMetadataId={objectPermissionsByObjectMetadataId}
      isRecordReadOnly={isReadOnly || isRecordReadOnly}
      useUpdateRecord={useUpdateOneObjectRecordMutation}
      recordLoading={recordLoading}
      instanceId={instanceId}
      onMouseEnter={() => setRecordFieldListHoverPosition(globalIndex)}
    />
  ));
};
