import { recordTableWidgetViewDraftComponentState } from '@/page-layout/states/recordTableWidgetViewDraftComponentState';
import { useAddDraftViewForFieldRelationTableWidget } from '@/page-layout/widgets/record-table/hooks/useAddDraftViewForFieldRelationTableWidget';
import { useRecordTableWidgetLayoutCallbacks } from '@/page-layout/widgets/record-table/hooks/useRecordTableWidgetLayoutCallbacks';
import { isFieldMetadataItemAvailableAsWidgetGroupByField } from '@/page-layout/widgets/record-table/utils/isFieldMetadataItemAvailableAsWidgetGroupByField';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { setTestObjectMetadataItemsInMetadataStore } from '~/testing/utils/setTestObjectMetadataItemsInMetadataStore';

const PAGE_LAYOUT_ID = 'page-layout-id';
const WIDGET_ID = 'widget-id';

it('replaces and clears native draft groups without changing junction traversal filters @custom', () => {
  const store = createStore();
  const objectMetadataItem = getMockObjectMetadataItemOrThrow('opportunity');
  const selectField = objectMetadataItem.readableFields.find(
    isFieldMetadataItemAvailableAsWidgetGroupByField,
  );

  if (!selectField) {
    throw new Error('Missing groupable SELECT fixture');
  }

  setTestObjectMetadataItemsInMetadataStore(
    store,
    getTestEnrichedObjectMetadataItemsMock(),
  );

  const wrapper = ({ children }: { children: ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  );

  const { result } = renderHook(
    () => ({
      ...useAddDraftViewForFieldRelationTableWidget(PAGE_LAYOUT_ID),
      ...useRecordTableWidgetLayoutCallbacks({
        pageLayoutId: PAGE_LAYOUT_ID,
        widgetId: WIDGET_ID,
      }),
    }),
    { wrapper },
  );

  act(() => {
    result.current.addDraftViewForFieldRelationTableWidget({
      widgetId: WIDGET_ID,
      targetObjectMetadataId: objectMetadataItem.id,
      inverseFieldMetadataId: 'report-junctions-field-id',
      relationTargetFieldMetadataId: 'junction-batch-field-id',
    });
  });

  const draftState = recordTableWidgetViewDraftComponentState.atomFamily({
    instanceId: PAGE_LAYOUT_ID,
  });
  const getSnapshot = () => store.get(draftState)[WIDGET_ID];
  const originalFilters = getSnapshot().viewFilters;

  for (const label of ['Fetch status', 'Format', 'Report type']) {
    const field = {
      ...selectField,
      id: label,
      label,
      options: (selectField.options ?? []).map((option) => ({
        ...option,
        value: `${label}-${option.value}`,
      })),
    };

    expect(field.options.length).toBeGreaterThan(0);

    act(() => result.current.handleGroupByFieldChange(field));

    expect(getSnapshot().view.mainGroupByFieldMetadataId).toBe(field.id);
    expect(getSnapshot().viewGroups.map((group) => group.fieldValue)).toEqual([
      ...(field.options ?? []).map((option) => option.value),
      ...(field.isNullable === true ? [''] : []),
    ]);
    expect(getSnapshot().viewFilters).toEqual(originalFilters);
  }

  act(() => result.current.handleGroupByFieldChange(null));

  expect(getSnapshot().view.mainGroupByFieldMetadataId).toBeNull();
  expect(getSnapshot().viewGroups).toEqual([]);
  expect(getSnapshot().viewFilters).toEqual(originalFilters);
});
