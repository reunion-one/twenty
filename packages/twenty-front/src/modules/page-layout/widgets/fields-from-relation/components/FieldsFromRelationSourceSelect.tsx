import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { fieldsWidgetGroupsDraftComponentState } from '@/page-layout/states/fieldsWidgetGroupsDraftComponentState';
import { fieldsWidgetUngroupedFieldsDraftComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsDraftComponentState';
import { fieldsWidgetEditorModeDraftComponentState } from '@/page-layout/states/fieldsWidgetEditorModeDraftComponentState';
import { hasInitializedFieldsWidgetGroupsDraftComponentState } from '@/page-layout/states/hasInitializedFieldsWidgetGroupsDraftComponentState';
import { getFieldsFromRelationSources } from '@/page-layout/widgets/fields-from-relation/utils/getFieldsFromRelationSources';
import { useUpdateCurrentWidgetConfig } from '@/side-panel/pages/page-layout/hooks/useUpdateCurrentWidgetConfig';
import { usePageLayoutSidePanelTarget } from '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget';
import { useWidgetInEditMode } from '@/side-panel/pages/page-layout/hooks/useWidgetInEditMode';
import { CommandMenuItemDropdownTrigger } from '@/command-menu/components/CommandMenuItemDropdownTrigger';
import { ChartSettingsDropdownSection } from '@/side-panel/pages/page-layout/components/chart-settings/ChartSettingsDropdownSection';
import { SelectOptionIcon } from '@/ui/input/components/SelectOptionIcon';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { useOpenDropdown } from '@/ui/layout/dropdown/hooks/useOpenDropdown';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconAddressBook } from 'twenty-ui/icon';
import { useState } from 'react';
import { filterBySearchQuery } from '~/utils/filterBySearchQuery';
import { useStore } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import { type FieldsFromRelationConfiguration } from '~/generated-metadata/graphql';
import { useIcons } from 'twenty-ui/icon/provider';
import { v4 } from 'uuid';

export const FieldsFromRelationSourceSelect = () => {
  const { t } = useLingui();
  const { getIcon } = useIcons();
  const { pageLayoutId, targetRecordIdentifier } =
    usePageLayoutSidePanelTarget();
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: targetRecordIdentifier.targetObjectNameSingular,
  });
  const { objectMetadataItems } = useObjectMetadataItems();
  const { widgetInEditMode } = useWidgetInEditMode(pageLayoutId);
  const { updateCurrentWidgetConfig } =
    useUpdateCurrentWidgetConfig(pageLayoutId);
  const store = useStore();
  const { openDropdown } = useOpenDropdown();
  const { closeDropdown } = useCloseDropdown();
  const [searchQuery, setSearchQuery] = useState('');
  if (!widgetInEditMode) {
    return null;
  }
  const configuration =
    widgetInEditMode.configuration as FieldsFromRelationConfiguration;
  const sources = getFieldsFromRelationSources(
    objectMetadataItem,
    objectMetadataItems,
  );

  const dropdownId = `fields-record-source-${widgetInEditMode.id}`;
  const selectedSource = sources.find(
    (source) =>
      source.fieldMetadataId === configuration.relationFieldMetadataId,
  );
  const options = [
    ...sources.map((source) => ({
      value: source.fieldMetadataId,
      label: source.label,
      Icon: getIcon(source.icon),
    })),
  ];
  const visibleOptions = filterBySearchQuery({
    items: options,
    searchQuery,
    getSearchableValues: (option) => [option.label],
  });

  const handleChange = (fieldMetadataId: string) => {
    closeDropdown(dropdownId);
    if (fieldMetadataId === (configuration.relationFieldMetadataId ?? '')) {
      return;
    }
    const source = sources.find(
      (item) => item.fieldMetadataId === fieldMetadataId,
    );
    if (!source) {
      return;
    }
    updateCurrentWidgetConfig({
      objectMetadataId: source.objectMetadataItem.id,
      configToUpdate: {
        relationFieldMetadataId: source.fieldMetadataId,
        viewId: v4(),
      },
    });
    store.set(
      fieldsWidgetGroupsDraftComponentState.atomFamily({
        instanceId: pageLayoutId,
      }),
      (previous) => {
        const next = { ...previous };
        delete next[widgetInEditMode.id];
        return next;
      },
    );
    store.set(
      fieldsWidgetUngroupedFieldsDraftComponentState.atomFamily({
        instanceId: pageLayoutId,
      }),
      (previous) => {
        const next = { ...previous };
        delete next[widgetInEditMode.id];
        return next;
      },
    );
    store.set(
      fieldsWidgetEditorModeDraftComponentState.atomFamily({
        instanceId: pageLayoutId,
      }),
      (previous) => {
        const next = { ...previous };
        delete next[widgetInEditMode.id];
        return next;
      },
    );
    store.set(
      hasInitializedFieldsWidgetGroupsDraftComponentState.atomFamily({
        instanceId: pageLayoutId,
      }),
      (previous) => {
        const next = { ...previous };
        delete next[widgetInEditMode.id];
        return next;
      },
    );
  };

  return (
    <SelectableListItem
      itemId="record-source"
      onEnter={() =>
        openDropdown({ dropdownComponentInstanceIdFromProps: dropdownId })
      }
    >
      <DropdownRoot dropdownId={dropdownId} type="picker">
        <CommandMenuItemDropdownTrigger
          id="record-source"
          label={t`Record source`}
          Icon={IconAddressBook}
          description={selectedSource?.label ?? t`Select relation`}
          contextualTextPosition="right"
        />
        <DropdownContent
          side="bottom"
          align="end"
          collisionPadding={{ left: 0, right: 0 }}
        >
          <Dropdown.Search
            placeholder={t`Search relations`}
            aria-label={t`Search relations`}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <Dropdown.Separator />
          <ChartSettingsDropdownSection>
            <Dropdown.SelectionGroup
              aria-label={t`Record source`}
              value={configuration.relationFieldMetadataId ?? ''}
            >
              {visibleOptions.map((option) => (
                <Dropdown.OptionItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleChange(option.value)}
                  startIcon={<SelectOptionIcon Icon={option.Icon} />}
                >
                  {option.label}
                </Dropdown.OptionItem>
              ))}
            </Dropdown.SelectionGroup>
            {visibleOptions.length === 0 && (
              <Dropdown.Empty>{t`No record sources found`}</Dropdown.Empty>
            )}
          </ChartSettingsDropdownSection>
        </DropdownContent>
      </DropdownRoot>
    </SelectableListItem>
  );
};
