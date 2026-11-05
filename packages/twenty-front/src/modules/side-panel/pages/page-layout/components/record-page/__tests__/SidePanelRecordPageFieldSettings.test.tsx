import { SidePanelRecordPageFieldSettings } from '@/side-panel/pages/page-layout/components/record-page/SidePanelRecordPageFieldSettings';
import { recordTableWidgetViewDraftComponentState } from '@/page-layout/states/recordTableWidgetViewDraftComponentState';
import { makeWidget } from '@/page-layout/testing/pageLayoutDraftFixtures';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { buildRecordTableWidgetViewSnapshot } from '@/page-layout/widgets/record-table/utils/buildRecordTableWidgetViewSnapshot';
import { isFieldMetadataItemAvailableAsWidgetGroupByField } from '@/page-layout/widgets/record-table/utils/isFieldMetadataItemAvailableAsWidgetGroupByField';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';
import {
  FieldDisplayMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';

const PAGE_LAYOUT_ID = 'page-layout-id';
const WIDGET_ID = 'widget-id';
const mockObjectMetadataItems = getTestEnrichedObjectMetadataItemsMock();
const personObjectMetadataItem = getMockObjectMetadataItemOrThrow('person');
const companyObjectMetadataItem = getMockObjectMetadataItemOrThrow('company');
const opportunityObjectMetadataItem =
  getMockObjectMetadataItemOrThrow('opportunity');
const mockSourceField = personObjectMetadataItem.fields.find(
  (field) => field.name === 'previousCompanies',
);
const selectTemplate = opportunityObjectMetadataItem.readableFields.find(
  isFieldMetadataItemAvailableAsWidgetGroupByField,
);

if (!mockSourceField || !selectTemplate?.options?.length) {
  throw new Error('Missing junction or SELECT fixture');
}

const groupingFields = ['Fetch status', 'Format', 'Report type'].map(
  (label, index) => ({
    ...selectTemplate,
    id: `grouping-field-${index}`,
    objectMetadataId: companyObjectMetadataItem.id,
    label,
  }),
);
const unreadableField = {
  ...groupingFields[0],
  id: 'unreadable-field',
  label: 'Private status',
};
const inactiveField = {
  ...groupingFields[0],
  id: 'inactive-field',
  label: 'Inactive status',
  isActive: false,
};
const targetIndex = mockObjectMetadataItems.findIndex(
  (item) => item.id === companyObjectMetadataItem.id,
);
mockObjectMetadataItems[targetIndex] = {
  ...companyObjectMetadataItem,
  fields: [
    ...companyObjectMetadataItem.fields,
    ...groupingFields,
    unreadableField,
    inactiveField,
  ],
  readableFields: [
    ...companyObjectMetadataItem.readableFields,
    ...groupingFields,
    inactiveField,
  ],
};
const mockSnapshot = buildRecordTableWidgetViewSnapshot(
  mockObjectMetadataItems[targetIndex],
);
const mockWidget: PageLayoutWidget = {
  ...makeWidget(WIDGET_ID, 0),
  type: WidgetType.FIELD,
  configuration: {
    __typename: 'FieldConfiguration',
    configurationType: WidgetConfigurationType.FIELD,
    fieldMetadataId: mockSourceField.id,
    fieldDisplayMode: FieldDisplayMode.TABLE,
    viewId: mockSnapshot.view.id,
  },
};

jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({
    objectMetadataItems: mockObjectMetadataItems,
  }),
}));
jest.mock('@/object-metadata/hooks/useFieldMetadataItemById', () => ({
  useFieldMetadataItemById: () => ({ fieldMetadataItem: mockSourceField }),
}));
jest.mock('@/views/hooks/useViewById', () => ({
  useViewById: () => ({ view: mockSnapshot.view }),
}));
jest.mock('@/side-panel/pages/page-layout/hooks/useWidgetInEditMode', () => ({
  useWidgetInEditMode: () => ({ widgetInEditMode: mockWidget }),
}));
jest.mock(
  '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget',
  () => ({
    usePageLayoutSidePanelTarget: () => ({ pageLayoutId: PAGE_LAYOUT_ID }),
  }),
);
jest.mock(
  '@/side-panel/pages/page-layout/hooks/useWidgetSettingsPlacementSelectableItemIds',
  () => ({
    useWidgetSettingsPlacementSelectableItemIds: () => ({
      placementSelectableItemIds: [],
      widgetSettingsPlacement: { isPlacementSectionVisible: false },
    }),
  }),
);
jest.mock(
  '@/side-panel/pages/page-layout/hooks/useUpdateCurrentWidgetConfig',
  () => ({
    useUpdateCurrentWidgetConfig: () => ({
      updateCurrentWidgetConfig: jest.fn(),
    }),
  }),
);
jest.mock('@/side-panel/hooks/useSidePanelSubPageHistory', () => ({
  useSidePanelSubPageHistory: () => ({ navigateToSidePanelSubPage: jest.fn() }),
}));
jest.mock(
  '@/page-layout/widgets/record-table/hooks/useRecordTableWidgetViewFieldItems',
  () => ({
    useRecordTableWidgetViewFieldItems: () => ({
      recordTableWidgetViewFieldItems: [],
    }),
  }),
);
jest.mock('@/ui/layout/dropdown/hooks/useOpenDropdown', () => ({
  useOpenDropdown: () => ({ openDropdown: jest.fn() }),
}));
jest.mock('@/ui/layout/dropdown/components/DropdownRoot', () => ({
  DropdownRoot: ({ children }: { children: ReactNode }) => {
    const { Dropdown } = jest.requireActual('twenty-ui/components/navigation');
    return <Dropdown.Root type="picker">{children}</Dropdown.Root>;
  },
}));
jest.mock('@/ui/layout/dropdown/components/DropdownContent', () => ({
  DropdownContent: ({ children }: { children: ReactNode }) => {
    const { Dropdown } = jest.requireActual('twenty-ui/components/navigation');
    return <Dropdown.Content>{children}</Dropdown.Content>;
  },
}));
jest.mock('@/command-menu/components/CommandMenuItemDropdownTrigger', () => ({
  CommandMenuItemDropdownTrigger: ({
    label,
    description,
  }: {
    label: string;
    description: string;
  }) => {
    const { Dropdown } = jest.requireActual('twenty-ui/components/navigation');
    return (
      <Dropdown.Trigger>
        {label}: {description}
      </Dropdown.Trigger>
    );
  },
}));
jest.mock('@/ui/input/components/SelectOptionIcon', () => ({
  SelectOptionIcon: () => null,
}));
jest.mock('twenty-ui/icon/provider', () => ({
  ...jest.requireActual('twenty-ui/icon/provider'),
  useIcons: () => ({ getIcon: () => undefined }),
}));

jest.mock('@/side-panel/components/SidePanelGroup', () => ({
  SidePanelGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/side-panel/components/SidePanelList', () => ({
  SidePanelList: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/ui/layout/selectable-list/components/SelectableListItem', () => ({
  SelectableListItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('@/command-menu/components/CommandMenuItem', () => ({
  CommandMenuItem: () => null,
}));

jest.mock('@/command-menu/components/CommandMenuItemSwitch', () => ({
  CommandMenuItemSwitch: () => null,
}));

jest.mock(
  '@/side-panel/pages/page-layout/components/WidgetSettingsManageSection',
  () => ({ WidgetSettingsManageSection: () => null }),
);

jest.mock(
  '@/side-panel/pages/page-layout/components/WidgetSettingsPlacementSection',
  () => ({ WidgetSettingsPlacementSection: () => null }),
);

jest.mock(
  '@/side-panel/pages/page-layout/components/dropdown-content/FieldWidgetFieldDropdownContent',
  () => ({ FieldWidgetFieldDropdownContent: () => null }),
);

jest.mock(
  '@/side-panel/pages/page-layout/components/dropdown-content/FieldWidgetLayoutDropdownContent',
  () => ({ FieldWidgetLayoutDropdownContent: () => null }),
);

describe('junction field widget native grouping @custom', () => {
  it('offers readable far-side SELECT fields and shows the selected label', async () => {
    const store = createStore();
    store.set(
      recordTableWidgetViewDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
      { [WIDGET_ID]: mockSnapshot },
    );
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <I18nProvider i18n={i18n}>
          <SidePanelRecordPageFieldSettings />
        </I18nProvider>
      </Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'Group by: None' }));
    for (const field of groupingFields) {
      expect(
        screen.getByRole('option', { name: field.label }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('option', { name: 'Private status' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Inactive status' }),
    ).not.toBeInTheDocument();
    const nameField = companyObjectMetadataItem.fields.find(
      (field) =>
        field.id === companyObjectMetadataItem.labelIdentifierFieldMetadataId,
    );
    expect(nameField).toBeDefined();
    expect(
      screen.queryByRole('option', { name: nameField?.label }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'Fetch status' }));
    expect(
      screen.getByRole('button', { name: 'Group by: Fetch status' }),
    ).toBeInTheDocument();
    const draft = store.get(
      recordTableWidgetViewDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
    )[WIDGET_ID];
    expect(draft.view.mainGroupByFieldMetadataId).toBe(groupingFields[0].id);
    expect(draft.viewGroups.length).toBeGreaterThan(0);
  });
});
