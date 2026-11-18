import { useInitializeFieldsWidgetGroupsDraft } from '@/page-layout/widgets/fields/hooks/useInitializeFieldsWidgetGroupsDraft';
import { fieldsWidgetUngroupedFieldsDraftComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsDraftComponentState';
import { fieldsWidgetUngroupedFieldsPersistedComponentState } from '@/page-layout/states/fieldsWidgetUngroupedFieldsPersistedComponentState';
import { hasInitializedFieldsWidgetGroupsDraftComponentState } from '@/page-layout/states/hasInitializedFieldsWidgetGroupsDraftComponentState';
import { fieldsWidgetGroupsDraftComponentState } from '@/page-layout/states/fieldsWidgetGroupsDraftComponentState';
import { type FieldsWidgetGroupField } from '@/page-layout/widgets/fields/types/FieldsWidgetGroup';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode } from 'react';

describe('useInitializeFieldsWidgetGroupsDraft @custom', () => {
  it('keeps persisted fields intact when changing the source so cancel can restore them', () => {
    const store = createStore();
    const key = { instanceId: 'layout' };
    const person = getMockObjectMetadataItemOrThrow('person');
    const company = getMockObjectMetadataItemOrThrow('company');
    const makeField = (object: typeof person): FieldsWidgetGroupField => ({
      fieldMetadataItem: object.fields[0],
      position: 0,
      globalIndex: 0,
      isVisible: true,
    });
    const original = [makeField(person)];
    const linked = [makeField(company)];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { rerender } = renderHook(
      ({ fields }) =>
        useInitializeFieldsWidgetGroupsDraft({
          pageLayoutId: 'layout',
          widgetId: 'widget',
          persistedGroups: [],
          persistedUngroupedFields: fields,
          persistedEditorMode: 'ungrouped',
        }),
      { wrapper, initialProps: { fields: original } },
    );
    expect(
      store.get(
        fieldsWidgetUngroupedFieldsPersistedComponentState.atomFamily(key),
      ).widget,
    ).toEqual(original);
    act(() => {
      store.set(fieldsWidgetGroupsDraftComponentState.atomFamily(key), {});
      store.set(
        fieldsWidgetUngroupedFieldsDraftComponentState.atomFamily(key),
        {},
      );
      store.set(
        hasInitializedFieldsWidgetGroupsDraftComponentState.atomFamily(key),
        {},
      );
    });
    rerender({ fields: linked });
    expect(
      store.get(fieldsWidgetUngroupedFieldsDraftComponentState.atomFamily(key))
        .widget,
    ).toEqual(linked);
    expect(
      store.get(
        fieldsWidgetUngroupedFieldsPersistedComponentState.atomFamily(key),
      ).widget,
    ).toEqual(original);
  });
});
