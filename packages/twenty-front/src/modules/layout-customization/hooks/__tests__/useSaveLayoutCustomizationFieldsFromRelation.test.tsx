import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { useSaveLayoutCustomization } from '@/layout-customization/hooks/useSaveLayoutCustomization';
import { activeCustomizationPageLayoutIdsState } from '@/layout-customization/states/activeCustomizationPageLayoutIdsState';
import { objectColorsDraftState } from '@/layout-customization/states/objectColorsDraftState';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { pageLayoutPersistedComponentState } from '@/page-layout/states/pageLayoutPersistedComponentState';
import {
  makeDraft,
  makeTab,
} from '@/page-layout/testing/pageLayoutDraftFixtures';
import { type PageLayout } from '@/page-layout/types/PageLayout';
import { createDefaultFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/createDefaultFieldsFromRelationWidget';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';

const mockUpdateObject = jest.fn();
const mockUpdateLayout = jest.fn();
const mockCreateFieldsViews = jest.fn();
const mockCreateTableViews = jest.fn();
const mockSaveWidgetData = jest.fn();
const mockExit = jest.fn();
const mockToast = jest.fn();

jest.mock('@/object-metadata/hooks/useUpdateOneObjectMetadataItem', () => ({
  useUpdateOneObjectMetadataItem: () => ({
    updateOneObjectMetadataItem: mockUpdateObject,
    refetchCommandMenuItems: jest.fn(),
  }),
}));
jest.mock(
  '@/command-menu-item/edit/hooks/useSaveCommandMenuItemsDraft',
  () => ({
    useSaveCommandMenuItemsDraft: () => ({
      saveCommandMenuItemsDraft: jest.fn(),
    }),
  }),
);
jest.mock('@/command-menu-item/hooks/useCommandMenuItemsDraftState', () => ({
  useCommandMenuItemsDraftState: () => ({ isDirty: false }),
}));
jest.mock(
  '@/navigation-menu-item/edit/hooks/useSaveNavigationMenuItemsDraft',
  () => ({ useSaveNavigationMenuItemsDraft: () => ({ saveDraft: jest.fn() }) }),
);
jest.mock('@/page-layout/hooks/useCreatePendingFieldsWidgetViews', () => ({
  useCreatePendingFieldsWidgetViews: () => ({
    createPendingFieldsWidgetViews: mockCreateFieldsViews,
  }),
}));
jest.mock('@/page-layout/hooks/useCreatePendingRecordTableWidgetViews', () => ({
  useCreatePendingRecordTableWidgetViews: () => ({
    createPendingRecordTableWidgetViews: mockCreateTableViews,
  }),
}));
jest.mock('@/page-layout/hooks/useSavePageLayoutWidgetsData', () => ({
  useSavePageLayoutWidgetsData: () => ({
    savePageLayoutWidgetsData: mockSaveWidgetData,
  }),
}));
jest.mock('@/page-layout/hooks/useUpdatePageLayoutWithTabsAndWidgets', () => ({
  useUpdatePageLayoutWithTabsAndWidgets: () => ({
    updatePageLayoutWithTabsAndWidgets: mockUpdateLayout,
  }),
}));
jest.mock(
  '@/layout-customization/hooks/useExitLayoutCustomizationMode',
  () => ({
    useExitLayoutCustomizationMode: () => ({
      exitLayoutCustomizationMode: mockExit,
    }),
  }),
);
jest.mock('twenty-ui/components/feedback', () => ({
  useToast: () => ({ enqueueToast: mockToast }),
}));

const createLayout = () => {
  const widget = createDefaultFieldsFromRelationWidget({
    id: 'widget',
    pageLayoutTabId: 'tab',
    objectMetadataId: 'company',
    positionIndex: 0,
  });
  const draft = makeDraft([
    makeTab('tab', [{ ...widget, title: 'Distributor details' }]),
  ]);
  const persisted: PageLayout = {
    ...draft,
    applicationId: '',
    universalIdentifier: draft.id,
    isSystemSideEffect: false,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
    defaultTabToFocusOnMobileAndSidePanelId: null,
  };
  const store = createStore();
  store.set(activeCustomizationPageLayoutIdsState.atom, [draft.id]);
  store.set(
    pageLayoutDraftComponentState.atomFamily({ instanceId: draft.id }),
    draft,
  );
  store.set(
    pageLayoutPersistedComponentState.atomFamily({ instanceId: draft.id }),
    persisted,
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <Provider store={store}>{children}</Provider>
    </I18nProvider>
  );
  return { store, draft, wrapper };
};

describe('Fields from relation save validation @custom', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the unconfigured widget and preserves all drafts before saving any changes', async () => {
    const { store, draft, wrapper } = createLayout();
    store.set(objectColorsDraftState.atom, { company: 'blue' });
    const { result } = renderHook(() => useSaveLayoutCustomization(), {
      wrapper,
    });
    await act(async () => {
      await result.current.save();
    });
    expect(mockToast).toHaveBeenCalledWith({
      status: 'error',
      children: 'Pick a source for "Distributor details" before saving',
    });
    expect(mockUpdateObject).not.toHaveBeenCalled();
    expect(mockUpdateLayout).not.toHaveBeenCalled();
    expect(mockCreateFieldsViews).not.toHaveBeenCalled();
    expect(mockCreateTableViews).not.toHaveBeenCalled();
    expect(mockSaveWidgetData).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
    expect(
      store.get(
        pageLayoutDraftComponentState.atomFamily({ instanceId: draft.id }),
      ),
    ).toEqual(draft);
    expect(store.get(objectColorsDraftState.atom)).toEqual({ company: 'blue' });
    expect(result.current.isSaving).toBe(false);
  });
});
