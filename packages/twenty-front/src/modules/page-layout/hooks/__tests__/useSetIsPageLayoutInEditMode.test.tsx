import { fieldsWidgetEditorModePersistedComponentState } from '@/page-layout/states/fieldsWidgetEditorModePersistedComponentState';
import { fieldsWidgetUngroupedFieldsPersistedComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsPersistedComponentState';
import { fieldsWidgetGroupsPersistedComponentState } from '@/page-layout/states/fieldsWidgetGroupsPersistedComponentState';
import { isLayoutCustomizationModeEnabledState } from '@/layout-customization/states/isLayoutCustomizationModeEnabledState';
import { useSetIsPageLayoutInEditMode } from '@/page-layout/hooks/useSetIsPageLayoutInEditMode';
import {
  PAGE_LAYOUT_TEST_INSTANCE_ID,
  PageLayoutTestWrapper,
} from '@/page-layout/hooks/__tests__/PageLayoutTestWrapper';
import { isDashboardInEditModeComponentState } from '@/page-layout/states/isDashboardInEditModeComponentState';
import { pageLayoutPersistedComponentState } from '@/page-layout/states/pageLayoutPersistedComponentState';
import { type PageLayout } from '@/page-layout/types/PageLayout';
import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';
import { type ReactNode } from 'react';
import { PageLayoutType } from '~/generated-metadata/graphql';

const MOCK_DASHBOARD_LAYOUT: PageLayout = {
  applicationId: 'application-id-mock',
  __typename: 'PageLayout',
  id: PAGE_LAYOUT_TEST_INSTANCE_ID,
  name: 'Dashboard Layout',
  type: PageLayoutType.DASHBOARD,
  isFirstTabPinned: true,
  isSystemSideEffect: false,
  objectMetadataId: 'object-metadata-id',
  universalIdentifier: '20202020-0000-0000-0000-000000000001',
  tabs: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  deletedAt: null,
  defaultTabToFocusOnMobileAndSidePanelId: null,
};

const getWrapper =
  (store = createStore()) =>
  ({ children }: { children: ReactNode }) => (
    <PageLayoutTestWrapper
      store={store}
      layoutType={PageLayoutType.DASHBOARD}
      instanceId={PAGE_LAYOUT_TEST_INSTANCE_ID}
    >
      {children}
    </PageLayoutTestWrapper>
  );

describe('useSetIsPageLayoutInEditMode', () => {
  it('should block dashboard edit mode while global layout customization is active', () => {
    const store = createStore();
    const wrapper = getWrapper(store);

    store.set(isLayoutCustomizationModeEnabledState.atom, true);
    store.set(
      pageLayoutPersistedComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_TEST_INSTANCE_ID,
      }),
      MOCK_DASHBOARD_LAYOUT,
    );

    const { result } = renderHook(
      () => useSetIsPageLayoutInEditMode(PAGE_LAYOUT_TEST_INSTANCE_ID),
      {
        wrapper,
      },
    );

    act(() => {
      result.current.setIsPageLayoutInEditMode(true);
    });

    expect(
      store.get(
        isDashboardInEditModeComponentState.atomFamily({
          instanceId: PAGE_LAYOUT_TEST_INSTANCE_ID,
        }),
      ),
    ).toBe(false);
  });

  it('should allow dashboard edit mode when global layout customization is inactive', () => {
    const store = createStore();
    const wrapper = getWrapper(store);

    store.set(isLayoutCustomizationModeEnabledState.atom, false);
    store.set(
      pageLayoutPersistedComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_TEST_INSTANCE_ID,
      }),
      MOCK_DASHBOARD_LAYOUT,
    );

    const { result } = renderHook(
      () => useSetIsPageLayoutInEditMode(PAGE_LAYOUT_TEST_INSTANCE_ID),
      {
        wrapper,
      },
    );

    act(() => {
      result.current.setIsPageLayoutInEditMode(true);
    });

    expect(
      store.get(
        isDashboardInEditModeComponentState.atomFamily({
          instanceId: PAGE_LAYOUT_TEST_INSTANCE_ID,
        }),
      ),
    ).toBe(true);
  });
});

describe('Fields baseline on re-entering edit mode @custom', () => {
  it('clears persisted fields so initialization can refresh the saved baseline', () => {
    const store = createStore();
    const key = { instanceId: PAGE_LAYOUT_TEST_INSTANCE_ID };
    store.set(fieldsWidgetGroupsPersistedComponentState.atomFamily(key), {
      widget: [],
    });
    store.set(
      fieldsWidgetUngroupedFieldsPersistedComponentState.atomFamily(key),
      { widget: [] },
    );
    store.set(fieldsWidgetEditorModePersistedComponentState.atomFamily(key), {
      widget: 'grouped',
    });
    const { result } = renderHook(
      () => useSetIsPageLayoutInEditMode(PAGE_LAYOUT_TEST_INSTANCE_ID),
      { wrapper: getWrapper(store) },
    );
    act(() => result.current.setIsPageLayoutInEditMode(true));
    expect(
      store.get(fieldsWidgetGroupsPersistedComponentState.atomFamily(key)),
    ).toEqual({});
    expect(
      store.get(
        fieldsWidgetUngroupedFieldsPersistedComponentState.atomFamily(key),
      ),
    ).toEqual({});
    expect(
      store.get(fieldsWidgetEditorModePersistedComponentState.atomFamily(key)),
    ).toEqual({});
  });
});
