import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { RecordFieldListInputContextProvider } from '@/object-record/record-field-list/anchored-portal/components/RecordFieldListInputContextProvider';
import { RecordFieldListComponentInstanceContext } from '@/object-record/record-field-list/states/contexts/RecordFieldListComponentInstanceContext';
import { recordFieldListCellEditModePositionComponentState } from '@/object-record/record-field-list/states/recordFieldListCellEditModePositionComponentState';
import { FieldInput } from '@/object-record/record-field/ui/components/FieldInput';
import { RelatedRecordFieldsInlineCellAnchoredPortal } from '@/page-layout/widgets/related-record-fields/components/RelatedRecordFieldsInlineCellAnchoredPortal';
import { RecordInlineCellEditMode } from '@/object-record/record-inline-cell/components/RecordInlineCellEditMode';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isDefined } from 'twenty-shared/utils';

type RelatedRecordFieldsWidgetCellEditModePortalProps = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  recordId: string;
  isReadOnly: boolean;
  flattenedFieldMetadataItems: FieldMetadataItem[];
};

export const RelatedRecordFieldsWidgetCellEditModePortal = ({
  objectMetadataItem,
  recordId,
  isReadOnly,
  flattenedFieldMetadataItems,
}: RelatedRecordFieldsWidgetCellEditModePortalProps) => {
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    RecordFieldListComponentInstanceContext,
  );

  const recordFieldListCellEditModePosition = useAtomComponentStateValue(
    recordFieldListCellEditModePositionComponentState,
  );

  const editedFieldMetadataItem = isDefined(recordFieldListCellEditModePosition)
    ? flattenedFieldMetadataItems.at(recordFieldListCellEditModePosition)
    : undefined;

  if (
    isReadOnly ||
    !isDefined(recordFieldListCellEditModePosition) ||
    !isDefined(editedFieldMetadataItem)
  ) {
    return null;
  }

  return (
    <RelatedRecordFieldsInlineCellAnchoredPortal
      isEditing
      isReadOnly={isReadOnly}
      fieldMetadataItem={editedFieldMetadataItem}
      objectMetadataItem={objectMetadataItem}
      recordId={recordId}
      instanceIdPrefix={instanceId}
    >
      <RecordFieldListInputContextProvider
        fieldMetadataItem={editedFieldMetadataItem}
        objectMetadataItem={objectMetadataItem}
        recordId={recordId}
        instanceIdPrefix={instanceId}
      >
        <RecordInlineCellEditMode>
          <FieldInput />
        </RecordInlineCellEditMode>
      </RecordFieldListInputContextProvider>
    </RelatedRecordFieldsInlineCellAnchoredPortal>
  );
};
