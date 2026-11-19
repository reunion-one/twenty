import { FieldsFromRelationSourceSelect } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationSourceSelect';
import { fieldsWidgetGroupsDraftComponentState } from '@/page-layout/states/fieldsWidgetGroupsDraftComponentState';
import { fieldsWidgetGroupsPersistedComponentState } from '@/page-layout/states/fieldsWidgetGroupsPersistedComponentState';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';

const mockObjects = getTestEnrichedObjectMetadataItemsMock();
const mockPerson = getMockObjectMetadataItemOrThrow('person');
const mockCompany = getMockObjectMetadataItemOrThrow('company');
const mockUpdateCurrentWidgetConfig = jest.fn();

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({ objectMetadataItem: mockPerson }),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({ objectMetadataItems: mockObjects }),
}));
jest.mock(
  '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget',
  () => ({
    usePageLayoutSidePanelTarget: () => ({
      pageLayoutId: 'layout',
      targetRecordIdentifier: { targetObjectNameSingular: 'person' },
    }),
  }),
);
jest.mock('@/side-panel/pages/page-layout/hooks/useWidgetInEditMode', () => ({
  useWidgetInEditMode: () => ({
    widgetInEditMode: { id: 'widget', configuration: {} },
  }),
}));
jest.mock(
  '@/side-panel/pages/page-layout/hooks/useUpdateCurrentWidgetConfig',
  () => ({
    useUpdateCurrentWidgetConfig: () => ({
      updateCurrentWidgetConfig: mockUpdateCurrentWidgetConfig,
    }),
  }),
);
jest.mock('twenty-ui/icon/provider', () => ({
  useIcons: () => ({ getIcon: () => () => null }),
}));
jest.mock('@/ui/layout/dropdown/hooks/useOpenDropdown', () => ({
  useOpenDropdown: () => ({ openDropdown: jest.fn() }),
}));
jest.mock('@/ui/layout/dropdown/hooks/useCloseDropdown', () => ({
  useCloseDropdown: () => ({ closeDropdown: jest.fn() }),
}));
jest.mock('@/ui/layout/selectable-list/components/SelectableListItem', () => ({
  SelectableListItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/ui/layout/dropdown/components/DropdownRoot', () => ({
  DropdownRoot: ({ children }: { children: React.ReactNode }) => {
    const { Dropdown } = jest.requireActual('twenty-ui/components/navigation');
    return <Dropdown.Root type="picker">{children}</Dropdown.Root>;
  },
}));
jest.mock('@/ui/layout/dropdown/components/DropdownContent', () => ({
  DropdownContent: ({ children }: { children: React.ReactNode }) => {
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
        {label}
        <span>{description}</span>
      </Dropdown.Trigger>
    );
  },
}));

describe('FieldsFromRelationSourceSelect @custom', () => {
  it('selects the linked object and starts a fresh layout without discarding saved selections', async () => {
    const store = createStore();
    const key = { instanceId: 'layout' };
    store.set(fieldsWidgetGroupsDraftComponentState.atomFamily(key), {
      widget: [],
    });
    store.set(fieldsWidgetGroupsPersistedComponentState.atomFamily(key), {
      widget: [],
    });
    const companyField = mockPerson.readableFields.find(
      (field) => field.name === 'company',
    );
    if (!companyField) {
      throw new Error('Missing company relation fixture');
    }
    render(
      <I18nProvider i18n={i18n}>
        <Provider store={store}>
          <FieldsFromRelationSourceSelect />
        </Provider>
      </I18nProvider>,
    );
    expect(
      screen.queryByRole('combobox', { name: 'Record source' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Record source/ }),
    );
    expect(screen.queryByText('Current record')).not.toBeInTheDocument();
    await userEvent.click(screen.getByText(companyField.label));
    expect(mockUpdateCurrentWidgetConfig).toHaveBeenCalledWith({
      objectMetadataId: mockCompany.id,
      configToUpdate: {
        relationFieldMetadataId: companyField.id,
        viewId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
    expect(
      store.get(fieldsWidgetGroupsDraftComponentState.atomFamily(key)),
    ).not.toHaveProperty('widget');
    expect(
      store.get(fieldsWidgetGroupsPersistedComponentState.atomFamily(key)),
    ).toHaveProperty('widget');
  });
});
