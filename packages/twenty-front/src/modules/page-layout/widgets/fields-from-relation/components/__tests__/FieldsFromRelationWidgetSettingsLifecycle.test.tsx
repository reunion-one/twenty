import { FieldsFromRelationWidgetSettings } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetSettings';
import { SidePanelFieldsLayoutSubPage } from '@/side-panel/pages/page-layout/components/SidePanelFieldsLayoutSubPage';
import { pageLayoutEditingWidgetIdComponentState } from '@/page-layout/states/pageLayoutEditingWidgetIdComponentState';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { createDefaultFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/createDefaultFieldsFromRelationWidget';
import {
  makeDraft,
  makeTab,
} from '@/page-layout/testing/pageLayoutDraftFixtures';
import { act, render, screen } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { setTestObjectMetadataItemsInMetadataStore } from '~/testing/utils/setTestObjectMetadataItemsInMetadataStore';

jest.mock('@/command-menu/components/CommandMenuItem', () => ({
  CommandMenuItem: ({ label }: { label: string }) => <button>{label}</button>,
}));
jest.mock('@/command-menu/components/CommandMenuItemSwitch', () => ({
  CommandMenuItemSwitch: ({ text }: { text: string }) => <span>{text}</span>,
}));
jest.mock('@/page-layout/widgets/fields/hooks/useFieldsWidgetGroups', () => ({
  useFieldsWidgetGroups: () => ({ groups: [] }),
}));
jest.mock(
  '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget',
  () => ({
    usePageLayoutSidePanelTarget: () => ({
      pageLayoutId: 'layout',
      targetRecordIdentifier: {
        id: 'person-record',
        targetObjectNameSingular: 'person',
      },
    }),
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
jest.mock('@/side-panel/components/SidePanelList', () => ({
  SidePanelList: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/side-panel/components/SidePanelGroup', () => ({
  SidePanelGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/ui/layout/selectable-list/components/SelectableListItem', () => ({
  SelectableListItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock(
  '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationSourceSelect',
  () => ({ FieldsFromRelationSourceSelect: () => null }),
);
jest.mock(
  '@/side-panel/pages/page-layout/components/NewFieldDefaultVisibilitySwitch',
  () => ({ NewFieldDefaultVisibilitySwitch: () => null }),
);
jest.mock(
  '@/side-panel/pages/page-layout/components/WidgetSettingsManageSection',
  () => ({ WidgetSettingsManageSection: () => null }),
);
jest.mock(
  '@/side-panel/pages/page-layout/components/WidgetSettingsPlacementSection',
  () => ({ WidgetSettingsPlacementSection: () => null }),
);
jest.mock(
  '@/page-layout/widgets/fields/components/FieldsWidgetGroupsDraftInitializationEffect',
  () => ({ FieldsWidgetGroupsDraftInitializationEffect: () => null }),
);
jest.mock(
  '@/page-layout/widgets/fields/components/FieldsConfigurationEditor',
  () => ({
    FieldsConfigurationEditor: ({
      objectNameSingular,
    }: {
      objectNameSingular: string;
    }) => <span>Fields of {objectNameSingular}</span>,
  }),
);

describe.each([
  { name: 'widget settings', Component: FieldsFromRelationWidgetSettings },
  { name: 'field layout editor', Component: SidePanelFieldsLayoutSubPage },
])('Fields from relation $name lifecycle @custom', ({ Component }) => {
  const setup = () => {
    const store = createStore();
    const objects = getTestEnrichedObjectMetadataItemsMock();
    setTestObjectMetadataItemsInMetadataStore(store, objects);
    const company = objects.find(
      (object) => object.nameSingular === 'company',
    )!;
    const widget = createDefaultFieldsFromRelationWidget({
      id: 'widget',
      pageLayoutTabId: 'tab',
      positionIndex: 0,
      objectMetadataId: company.id,
    });
    const draft = { ...makeDraft([makeTab('tab', [widget])]), id: 'layout' };
    const key = { instanceId: 'layout' };
    store.set(pageLayoutDraftComponentState.atomFamily(key), draft);
    store.set(
      pageLayoutEditingWidgetIdComponentState.atomFamily(key),
      widget.id,
    );
    const rendered = render(
      <I18nProvider i18n={i18n}>
        <Provider store={store}>
          <span>Record page remains available</span>
          <Component />
        </Provider>
      </I18nProvider>,
    );
    return { store, draft, widget, key, ...rendered };
  };

  it('does not throw when Save clears the selected widget before the panel closes', () => {
    const { store, key, container } = setup();
    expect(container.textContent).toMatch(/Allow editing|Fields of company/);
    expect(() =>
      act(() => {
        store.set(
          pageLayoutEditingWidgetIdComponentState.atomFamily(key),
          null,
        );
      }),
    ).not.toThrow();
    expect(screen.getByText('Record page remains available')).toBeVisible();
    expect(container.textContent).not.toMatch(
      /Allow editing|Fields of company/,
    );
  });

  it('does not throw when replacement removes the selected widget from the draft', () => {
    const { store, draft, key } = setup();
    expect(() =>
      act(() => {
        store.set(pageLayoutDraftComponentState.atomFamily(key), {
          ...draft,
          tabs: [makeTab('tab', [])],
        });
      }),
    ).not.toThrow();
    expect(screen.getByText('Record page remains available')).toBeVisible();
  });

  it('uses the page object when the widget has no object metadata id', () => {
    const { store, draft, widget, key, container } = setup();
    expect(() =>
      act(() => {
        store.set(pageLayoutDraftComponentState.atomFamily(key), {
          ...draft,
          tabs: [makeTab('tab', [{ ...widget, objectMetadataId: null }])],
        });
      }),
    ).not.toThrow();
    expect(container.textContent).toMatch(/Allow editing|Fields of person/);
  });
});
