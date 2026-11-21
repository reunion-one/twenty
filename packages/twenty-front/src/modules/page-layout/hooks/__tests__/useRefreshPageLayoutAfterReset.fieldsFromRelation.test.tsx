import { useRefreshPageLayoutAfterReset } from '@/page-layout/hooks/useRefreshPageLayoutAfterReset';
import { fieldsWidgetGroupsPersistedComponentState } from '@/page-layout/states/fieldsWidgetGroupsPersistedComponentState';
import { fieldsWidgetUngroupedFieldsPersistedComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsPersistedComponentState';
import { fieldsWidgetEditorModePersistedComponentState } from '@/page-layout/states/fieldsWidgetEditorModePersistedComponentState';
import { pageLayoutPersistedComponentState } from '@/page-layout/states/pageLayoutPersistedComponentState';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';
import { PageLayoutType } from '~/generated-metadata/graphql';

const mockQuery = jest.fn();
const mockSetEditMode = jest.fn();
const mockExit = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ query: mockQuery }),
}));
jest.mock('@/page-layout/hooks/useSetIsPageLayoutInEditMode', () => ({
  useSetIsPageLayoutInEditMode: () => ({
    setIsPageLayoutInEditMode: mockSetEditMode,
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
jest.mock('@/metadata-store/hooks/useInvalidateMetadataStore', () => ({
  useInvalidateMetadataStore: () => ({
    invalidateMetadataStore: mockInvalidate,
  }),
}));

describe('Reset fields baseline @custom', () => {
  it('discards pre-reset persisted fields while reloading the server layout', async () => {
    const store = createStore();
    const key = { instanceId: 'layout' };
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
    mockQuery.mockResolvedValue({
      data: {
        getPageLayout: {
          id: 'layout',
          name: 'Fresh defaults',
          type: PageLayoutType.RECORD_PAGE,
          tabs: [],
        },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(
      () => useRefreshPageLayoutAfterReset('layout'),
      { wrapper },
    );
    await act(async () => {
      await result.current.refreshPageLayoutAfterReset();
    });
    expect(
      store.get(pageLayoutPersistedComponentState.atomFamily(key))?.name,
    ).toBe('Fresh defaults');
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
    expect(mockSetEditMode).toHaveBeenCalledWith(false);
    expect(mockExit).toHaveBeenCalled();
  });
});
