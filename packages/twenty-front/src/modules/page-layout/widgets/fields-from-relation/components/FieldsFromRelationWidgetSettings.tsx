import { FieldsFromRelationSourceSelect } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationSourceSelect';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { CommandMenuItem } from '@/command-menu/components/CommandMenuItem';
import { CommandMenuItemSwitch } from '@/command-menu/components/CommandMenuItemSwitch';
import { useFieldsWidgetGroups } from '@/page-layout/widgets/fields/hooks/useFieldsWidgetGroups';
import { SidePanelGroup } from '@/side-panel/components/SidePanelGroup';
import { SidePanelList } from '@/side-panel/components/SidePanelList';
import { useSidePanelSubPageHistory } from '@/side-panel/hooks/useSidePanelSubPageHistory';
import { NewFieldDefaultVisibilitySwitch } from '@/side-panel/pages/page-layout/components/NewFieldDefaultVisibilitySwitch';
import { WidgetSettingsManageSection } from '@/side-panel/pages/page-layout/components/WidgetSettingsManageSection';
import { WidgetSettingsPlacementSection } from '@/side-panel/pages/page-layout/components/WidgetSettingsPlacementSection';
import { WIDGET_SETTINGS_SELECTABLE_ITEM_IDS } from '@/side-panel/pages/page-layout/constants/settings/WidgetSettingsSelectableItemIds';
import { usePageLayoutSidePanelTarget } from '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget';
import { useUpdateCurrentWidgetConfig } from '@/side-panel/pages/page-layout/hooks/useUpdateCurrentWidgetConfig';
import { useWidgetInEditMode } from '@/side-panel/pages/page-layout/hooks/useWidgetInEditMode';
import { useWidgetSettingsPlacementSelectableItemIds } from '@/side-panel/pages/page-layout/hooks/useWidgetSettingsPlacementSelectableItemIds';
import { SidePanelSubPages } from '@/side-panel/types/SidePanelSubPages';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import {
  IconEdit,
  IconChevronDown,
  IconLayoutSidebarRight,
} from 'twenty-ui/icon';
import { type FieldsFromRelationConfiguration } from '~/generated-metadata/graphql';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledSidePanelContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`;

export const FieldsFromRelationWidgetSettings = () => {
  const { t } = useLingui();
  const { navigateToSidePanelSubPage } = useSidePanelSubPageHistory();
  const { pageLayoutId, targetRecordIdentifier } =
    usePageLayoutSidePanelTarget();

  const { placementSelectableItemIds, widgetSettingsPlacement } =
    useWidgetSettingsPlacementSelectableItemIds(pageLayoutId);

  const { updateCurrentWidgetConfig } =
    useUpdateCurrentWidgetConfig(pageLayoutId);

  const { widgetInEditMode } = useWidgetInEditMode(pageLayoutId);

  const fieldsConfiguration = widgetInEditMode?.configuration as
    | FieldsFromRelationConfiguration
    | undefined;

  const { objectMetadataItems } = useObjectMetadataItems();
  const objectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.id === widgetInEditMode?.objectMetadataId,
  );

  const { groups } = useFieldsWidgetGroups({
    viewId: fieldsConfiguration?.viewId ?? null,
    objectNameSingular:
      objectMetadataItem?.nameSingular ??
      targetRecordIdentifier.targetObjectNameSingular,
  });

  if (!isDefined(widgetInEditMode)) {
    return null;
  }

  const totalFieldsCount = groups.reduce(
    (count, group) => count + group.fields.length,
    0,
  );

  const handleNavigateToLayout = () => {
    navigateToSidePanelSubPage(SidePanelSubPages.PageLayoutFieldsLayout);
  };

  const isShouldAllowUserToSeeHiddenFieldsToggled =
    fieldsConfiguration?.shouldAllowUserToSeeHiddenFields === true;

  const handleToggleShouldAllowUserToSeeHiddenFields = () => {
    updateCurrentWidgetConfig({
      configToUpdate: {
        shouldAllowUserToSeeHiddenFields:
          !isShouldAllowUserToSeeHiddenFieldsToggled,
      },
    });
  };

  const selectableItemIds = [
    'record-source',
    'allow-editing',
    'layout',
    'new-field-default-visibility',
    'display-more-fields-button',
    'action-button',
    WIDGET_SETTINGS_SELECTABLE_ITEM_IDS.VISIBILITY_RESTRICTION,
    WIDGET_SETTINGS_SELECTABLE_ITEM_IDS.RESET_TO_DEFAULT,
    WIDGET_SETTINGS_SELECTABLE_ITEM_IDS.REPLACE_WIDGET,
    WIDGET_SETTINGS_SELECTABLE_ITEM_IDS.DELETE_WIDGET,
    ...placementSelectableItemIds,
  ];

  return (
    <StyledContainer>
      <StyledSidePanelContainer>
        <SidePanelList selectableItemIds={selectableItemIds}>
          <SidePanelGroup heading={t`Data and display`}>
            <FieldsFromRelationSourceSelect />
            <SelectableListItem
              itemId="allow-editing"
              onEnter={() =>
                updateCurrentWidgetConfig({
                  configToUpdate: {
                    isReadOnly: fieldsConfiguration?.isReadOnly !== true,
                  },
                })
              }
            >
              <CommandMenuItemSwitch
                LeftIcon={IconEdit}
                text={t`Allow editing`}
                id="allow-editing"
                checked={fieldsConfiguration?.isReadOnly !== true}
                onCheckedChange={(allowEditing) =>
                  updateCurrentWidgetConfig({
                    configToUpdate: { isReadOnly: !allowEditing },
                  })
                }
              />
            </SelectableListItem>
            <SelectableListItem
              itemId="layout"
              onEnter={
                isDefined(fieldsConfiguration?.relationFieldMetadataId) &&
                fieldsConfiguration.relationFieldMetadataId !== ''
                  ? handleNavigateToLayout
                  : undefined
              }
            >
              <CommandMenuItem
                id="layout"
                label={t`Layout`}
                Icon={IconLayoutSidebarRight}
                hasSubMenu
                onClick={handleNavigateToLayout}
                disabled={!fieldsConfiguration?.relationFieldMetadataId}
                description={t`${totalFieldsCount} visible fields`}
                contextualTextPosition="right"
              />
            </SelectableListItem>
            <SelectableListItem
              itemId="display-more-fields-button"
              onEnter={handleToggleShouldAllowUserToSeeHiddenFields}
            >
              <CommandMenuItemSwitch
                LeftIcon={IconChevronDown}
                text={t`Display "More fields" button`}
                id="display-more-fields-button"
                checked={isShouldAllowUserToSeeHiddenFieldsToggled}
                onCheckedChange={handleToggleShouldAllowUserToSeeHiddenFields}
              />
            </SelectableListItem>
            <NewFieldDefaultVisibilitySwitch
              pageLayoutId={pageLayoutId}
              widgetId={widgetInEditMode.id}
            />
          </SidePanelGroup>
          <WidgetSettingsManageSection pageLayoutId={pageLayoutId} />
          <WidgetSettingsPlacementSection
            pageLayoutId={pageLayoutId}
            isPlacementSectionVisible={
              widgetSettingsPlacement.isPlacementSectionVisible
            }
            pageLayoutEditingWidgetId={
              widgetSettingsPlacement.pageLayoutEditingWidgetId
            }
            showAddWidgetBelow={widgetSettingsPlacement.showAddWidgetBelow}
            showMoveDown={widgetSettingsPlacement.showMoveDown}
            showMoveUp={widgetSettingsPlacement.showMoveUp}
          />
        </SidePanelList>
      </StyledSidePanelContainer>
    </StyledContainer>
  );
};
