import { fieldsWidgetEditorModePersistedComponentState } from '@/page-layout/states/fieldsWidgetEditorModePersistedComponentState';
import { fieldsWidgetUngroupedFieldsPersistedComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsPersistedComponentState';
import { fieldsWidgetGroupsPersistedComponentState } from '@/page-layout/states/fieldsWidgetGroupsPersistedComponentState';
import { useSetIsPageLayoutInEditMode } from '@/page-layout/hooks/useSetIsPageLayoutInEditMode';
import {
  PAGE_LAYOUT_TEST_INSTANCE_ID,
  PageLayoutTestWrapper,
} from '@/page-layout/hooks/__tests__/PageLayoutTestWrapper';
import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';
import { type ReactNode } from 'react';

const getWrapper =
  (store: ReturnType<typeof createStore>) =>
  ({ children }: { children: ReactNode }) => (
    <PageLayoutTestWrapper
      store={store}
      instanceId={PAGE_LAYOUT_TEST_INSTANCE_ID}
    >
      {children}
    </PageLayoutTestWrapper>
  );

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
