import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { formatFieldMetadataItemAsColumnDefinition } from '@/object-metadata/utils/formatFieldMetadataItemAsColumnDefinition';
import { isRecordFieldReadOnly } from '@/object-record/read-only/utils/isRecordFieldReadOnly';
import {
  FieldContext,
  type RecordUpdateHook,
} from '@/object-record/record-field/ui/contexts/FieldContext';
import { RecordFieldComponentInstanceContext } from '@/object-record/record-field/ui/states/contexts/RecordFieldComponentInstanceContext';
import { isJunctionRelationForbidden } from '@/object-record/record-field/ui/utils/junction/isJunctionRelationForbidden';
import { RecordInlineCell } from '@/object-record/record-inline-cell/components/RecordInlineCell';
import { getRecordFieldInputInstanceId } from '@/object-record/utils/getRecordFieldInputId';
import { type ObjectPermissionsByObjectMetadataId } from '@/object-metadata/types/ObjectPermissionsByObjectMetadataId';

type FieldsFromRelationWidgetFieldItemProps = {
  fieldMetadataItem: FieldMetadataItem;
  globalIndex: number;
  recordId: string;
  restrictedFieldNames: string[];
  objectMetadataItem: EnrichedObjectMetadataItem;
  objectMetadataItems: EnrichedObjectMetadataItem[];
  objectPermissionsByObjectMetadataId: ObjectPermissionsByObjectMetadataId;
  isRecordReadOnly: boolean;
  useUpdateRecord: RecordUpdateHook;
  recordLoading: boolean;
  instanceId: string;
  onMouseEnter: () => void;
};

export const FieldsFromRelationWidgetFieldItem = ({
  fieldMetadataItem,
  globalIndex,
  recordId,
  restrictedFieldNames,
  objectMetadataItem,
  objectMetadataItems,
  objectPermissionsByObjectMetadataId,
  isRecordReadOnly,
  useUpdateRecord,
  recordLoading,
  instanceId,
  onMouseEnter,
}: FieldsFromRelationWidgetFieldItemProps) => {
  const fieldDefinition = formatFieldMetadataItemAsColumnDefinition({
    field: fieldMetadataItem,
    position: globalIndex,
    objectMetadataItem,
    showLabel: true,
    labelWidth: 90,
  });

  const isFieldRestricted = restrictedFieldNames.includes(
    fieldMetadataItem.name,
  );

  const isForbidden =
    isFieldRestricted ||
    isJunctionRelationForbidden({
      fieldMetadataItem,
      sourceObjectMetadataId: objectMetadataItem.id,
      objectMetadataItems,
      objectPermissionsByObjectMetadataId,
    });

  const isFieldReadOnly =
    isForbidden ||
    isRecordFieldReadOnly({
      isRecordReadOnly,
      objectMetadataId: objectMetadataItem.id,
      fieldMetadataItem,
      fieldDefinition,
      objectPermissionsByObjectMetadataId,
    });

  return (
    <FieldContext.Provider
      key={recordId + fieldMetadataItem.id}
      value={{
        recordId,
        maxWidth: 200,
        isLabelIdentifier: false,
        fieldDefinition,
        useUpdateRecord,
        isDisplayModeFixHeight: true,
        isRecordFieldReadOnly: isFieldReadOnly,
        // Native display cells can invoke the open handler even when read-only.
        onOpenEditMode: isFieldReadOnly ? () => undefined : undefined,
        onMouseEnter,
        anchorId: `${getRecordFieldInputInstanceId({
          recordId,
          fieldName: fieldMetadataItem.name,
          prefix: instanceId,
        })}`,
        isForbidden,
      }}
    >
      <RecordFieldComponentInstanceContext.Provider
        value={{
          instanceId: getRecordFieldInputInstanceId({
            recordId,
            fieldName: fieldMetadataItem.name,
            prefix: instanceId,
          }),
        }}
      >
        <RecordInlineCell loading={recordLoading} />
      </RecordFieldComponentInstanceContext.Provider>
    </FieldContext.Provider>
  );
};
