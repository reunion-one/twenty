import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { RecordFieldListCellHoveredPortalContent } from '@/object-record/record-field-list/anchored-portal/components/RecordFieldListCellHoveredPortalContent';
import { RecordFieldListInputContextProvider } from '@/object-record/record-field-list/anchored-portal/components/RecordFieldListInputContextProvider';
import { RecordFieldListComponentInstanceContext } from '@/object-record/record-field-list/states/contexts/RecordFieldListComponentInstanceContext';
import { recordFieldListHoverPositionComponentState } from '@/object-record/record-field-list/states/recordFieldListHoverPositionComponentState';
import { FieldsFromRelationInlineCellAnchoredPortal } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationInlineCellAnchoredPortal';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { isDefined } from 'twenty-shared/utils';

type FieldsFromRelationWidgetCellHoveredPortalProps = {
  objectMetadataItem: EnrichedObjectMetadataItem;
  recordId: string;
  isReadOnly: boolean;
  flattenedFieldMetadataItems: FieldMetadataItem[];
};

export const FieldsFromRelationWidgetCellHoveredPortal = ({
  objectMetadataItem,
  recordId,
  isReadOnly,
  flattenedFieldMetadataItems,
}: FieldsFromRelationWidgetCellHoveredPortalProps) => {
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    RecordFieldListComponentInstanceContext,
  );

  const recordFieldListHoverPosition = useAtomComponentStateValue(
    recordFieldListHoverPositionComponentState,
  );

  const hoveredFieldMetadataItem = isDefined(recordFieldListHoverPosition)
    ? flattenedFieldMetadataItems.at(recordFieldListHoverPosition)
    : undefined;

  if (
    !isDefined(recordFieldListHoverPosition) ||
    !isDefined(hoveredFieldMetadataItem)
  ) {
    return null;
  }

  return (
    <FieldsFromRelationInlineCellAnchoredPortal
      isReadOnly={isReadOnly}
      fieldMetadataItem={hoveredFieldMetadataItem}
      objectMetadataItem={objectMetadataItem}
      recordId={recordId}
      instanceIdPrefix={instanceId}
    >
      <RecordFieldListInputContextProvider
        fieldMetadataItem={hoveredFieldMetadataItem}
        objectMetadataItem={objectMetadataItem}
        recordId={recordId}
        instanceIdPrefix={instanceId}
      >
        <RecordFieldListCellHoveredPortalContent />
      </RecordFieldListInputContextProvider>
    </FieldsFromRelationInlineCellAnchoredPortal>
  );
};
