import { useRecordRestrictedFieldNames } from '@/object-record/record-store/hooks/useRecordRestrictedFieldNames';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { FieldsFromRelationWidgetRecord } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetRecord';
import { getFieldsFromRelationSources } from '@/page-layout/widgets/fields-from-relation/utils/getFieldsFromRelationSources';
import { isDefined } from 'twenty-shared/utils';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { RecordFieldListComponentInstanceContext } from '@/object-record/record-field-list/states/contexts/RecordFieldListComponentInstanceContext';
import { FieldDescriptionTooltipProvider } from '@/object-record/record-field/ui/components/FieldDescriptionTooltipProvider';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { FieldsFromRelationWidgetCellEditModePortal } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetCellEditModePortal';
import { FieldsFromRelationWidgetCellHoveredPortal } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetCellHoveredPortal';
import { FieldsFromRelationWidgetFieldList } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetFieldList';
import { FieldsWidgetGroupContainer } from '@/page-layout/widgets/fields/components/FieldsWidgetGroupContainer';
import { useFieldsWidgetGroupsForDisplay } from '@/page-layout/widgets/fields/hooks/useFieldsWidgetGroupsForDisplay';
import { useFieldsWidgetHiddenFieldsForDisplay } from '@/page-layout/widgets/fields/hooks/useFieldsWidgetHiddenFieldsForDisplay';
import { StyledWidgetScrollContainer } from '@/ui/layout/components/WidgetContentContainer';
import { useTargetRecord } from '@/ui/layout/contexts/useTargetRecord';
import { useWorkspaceSurface } from '@/ui/layout/hooks/useWorkspaceSurface';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';

import { themeCssVariables } from 'twenty-ui/theme';
import { type FieldsFromRelationConfiguration } from '~/generated-metadata/graphql';

const StyledPropertyBox = styled.div`
  align-self: stretch;
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding-bottom: ${themeCssVariables.spacing[3]};
  padding-top: ${themeCssVariables.spacing[3]};
`;

const StyledInlineFieldsPropertyBox = styled.div<{
  hasMoreGroup: boolean;
}>`
  align-self: stretch;
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding-bottom: ${({ hasMoreGroup }) =>
    hasMoreGroup ? themeCssVariables.spacing[3] : '0'};
  padding-top: 0;
`;

type FieldsFromRelationWidgetProps = {
  widget: PageLayoutWidget;
};

type FieldsFromRelationWidgetContentProps = FieldsFromRelationWidgetProps;

const FieldsFromRelationWidgetContent = ({
  widget,
}: FieldsFromRelationWidgetContentProps) => {
  const targetRecord = useTargetRecord();
  const isInSidePanel = useWorkspaceSurface().type === 'side-panel';

  const instanceId = `fields-${widget.id}-${targetRecord.id}${isInSidePanel ? '-side-panel' : ''}`;

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const fieldsConfiguration =
    widget.configuration as FieldsFromRelationConfiguration;

  const { groups, displayMode } = useFieldsWidgetGroupsForDisplay({
    widgetId: widget.id,
    viewId: fieldsConfiguration.viewId ?? null,
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const { hiddenFields } = useFieldsWidgetHiddenFieldsForDisplay({
    widgetId: widget.id,
    viewId: fieldsConfiguration.viewId ?? null,
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });

  const shouldShowHiddenFields =
    fieldsConfiguration.shouldAllowUserToSeeHiddenFields === true &&
    hiddenFields.length > 0;

  const visibleFields = groups.flatMap((group) => group.fields);

  const hiddenFieldsWithOffsetGlobalIndex = shouldShowHiddenFields
    ? hiddenFields.map((field) => ({
        ...field,
        globalIndex: field.globalIndex + visibleFields.length,
      }))
    : [];

  const flattenedFieldMetadataItems = [
    ...visibleFields.map((field) => field.fieldMetadataItem),
    ...hiddenFieldsWithOffsetGlobalIndex.map(
      (field) => field.fieldMetadataItem,
    ),
  ];

  const hasFieldsToDisplay = groups.length > 0;

  const shouldDisplayGroupHeaders =
    displayMode === 'grouped' && groups.length > 1;

  if (!hasFieldsToDisplay) {
    return null;
  }

  return (
    <FieldDescriptionTooltipProvider>
      <StyledWidgetScrollContainer>
        <RecordFieldListComponentInstanceContext.Provider
          value={{
            instanceId,
          }}
        >
          {shouldDisplayGroupHeaders ? (
            groups.map((group) => (
              <FieldsWidgetGroupContainer key={group.id} title={group.name}>
                <StyledPropertyBox>
                  <FieldsFromRelationWidgetFieldList
                    fields={group.fields}
                    instanceId={instanceId}
                    isReadOnly={fieldsConfiguration.isReadOnly === true}
                  />
                </StyledPropertyBox>
              </FieldsWidgetGroupContainer>
            ))
          ) : (
            <StyledInlineFieldsPropertyBox
              hasMoreGroup={shouldShowHiddenFields}
            >
              <FieldsFromRelationWidgetFieldList
                fields={visibleFields}
                instanceId={instanceId}
                isReadOnly={fieldsConfiguration.isReadOnly === true}
              />
            </StyledInlineFieldsPropertyBox>
          )}

          {shouldShowHiddenFields && (
            <FieldsWidgetGroupContainer
              title={t`More (${hiddenFieldsWithOffsetGlobalIndex.length})`}
              defaultExpanded={false}
            >
              <StyledPropertyBox>
                <FieldsFromRelationWidgetFieldList
                  fields={hiddenFieldsWithOffsetGlobalIndex}
                  instanceId={instanceId}
                  isReadOnly={fieldsConfiguration.isReadOnly === true}
                />
              </StyledPropertyBox>
            </FieldsWidgetGroupContainer>
          )}

          <FieldsFromRelationWidgetCellHoveredPortal
            objectMetadataItem={objectMetadataItem}
            recordId={targetRecord.id}
            flattenedFieldMetadataItems={flattenedFieldMetadataItems}
            isReadOnly={fieldsConfiguration.isReadOnly === true}
          />
          <FieldsFromRelationWidgetCellEditModePortal
            objectMetadataItem={objectMetadataItem}
            recordId={targetRecord.id}
            flattenedFieldMetadataItems={flattenedFieldMetadataItems}
            isReadOnly={fieldsConfiguration.isReadOnly === true}
          />
        </RecordFieldListComponentInstanceContext.Provider>
      </StyledWidgetScrollContainer>
    </FieldDescriptionTooltipProvider>
  );
};

export const FieldsFromRelationWidget = ({
  widget,
}: FieldsFromRelationWidgetProps) => {
  const targetRecord = useTargetRecord();
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetRecord.targetObjectNameSingular,
  });
  const { objectMetadataItems } = useObjectMetadataItems();
  const restrictedFieldNames = useRecordRestrictedFieldNames(targetRecord.id);
  const configuration = widget.configuration as FieldsFromRelationConfiguration;
  const source = getFieldsFromRelationSources(
    objectMetadataItem,
    objectMetadataItems,
  ).find(
    (item) => item.fieldMetadataId === configuration.relationFieldMetadataId,
  );
  const pointedRecordId = useAtomFamilySelectorValue(
    recordStoreFamilySelector,
    {
      recordId: targetRecord.id,
      fieldName: source ? `${source.fieldName}Id` : 'id',
    },
  );

  if (
    !configuration.relationFieldMetadataId ||
    !isDefined(source) ||
    restrictedFieldNames.includes(source.fieldName) ||
    typeof pointedRecordId !== 'string'
  ) {
    return null;
  }

  return (
    <FieldsFromRelationWidgetRecord
      key={`${source.fieldMetadataId}-${pointedRecordId}`}
      widgetId={widget.id}
      objectNameSingular={source.objectMetadataItem.nameSingular}
      recordId={pointedRecordId}
    >
      <FieldsFromRelationWidgetContent widget={widget} />
    </FieldsFromRelationWidgetRecord>
  );
};
