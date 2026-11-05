import { recordTableWidgetViewPersistedComponentState } from '@/page-layout/states/recordTableWidgetViewPersistedComponentState';
import { useRecordTableWidgetLayoutCallbacks } from '@/page-layout/widgets/record-table/hooks/useRecordTableWidgetLayoutCallbacks';
import { buildMissingRecordTableWidgetViewDraftSnapshots } from '@/page-layout/widgets/record-table/utils/buildMissingRecordTableWidgetViewDraftSnapshots';
import { constructViewFromRecordTableWidgetViewSnapshot } from '@/page-layout/widgets/record-table/utils/constructViewFromRecordTableWidgetViewSnapshot';
import { isFieldMetadataItemAvailableAsWidgetGroupByField } from '@/page-layout/widgets/record-table/utils/isFieldMetadataItemAvailableAsWidgetGroupByField';
import { type FlatViewFilter } from '@/metadata-store/types/FlatViewFilter';
import { UPSERT_VIEW_WIDGET } from '@/page-layout/graphql/mutations/upsertViewWidget';
import { useSaveRecordTableWidgetViews } from '@/page-layout/hooks/useSaveRecordTableWidgetViews';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { recordTableWidgetViewDraftComponentState } from '@/page-layout/states/recordTableWidgetViewDraftComponentState';
import {
  makeDraft,
  makeTab,
  makeWidget,
} from '@/page-layout/testing/pageLayoutDraftFixtures';
import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { buildRecordTableWidgetViewSnapshot } from '@/page-layout/widgets/record-table/utils/buildRecordTableWidgetViewSnapshot';
import { type MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { act, renderHook } from '@testing-library/react';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { ViewFilterOperand } from 'twenty-shared/types';
import {
  FieldDisplayMode,
  WidgetConfigurationType,
  WidgetType,
  type UpsertViewWidgetInput,
} from '~/generated-metadata/graphql';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

const PAGE_LAYOUT_ID = 'page-layout-id';
const WIDGET_ID = 'widget-id';

const SOURCE_FIELD_METADATA_ID = '20202020-51cf-4b06-b1d3-a836e857f9dd';
const RELATION_TARGET_FIELD_METADATA_ID =
  '20202020-1af7-4b09-a58a-b18aaaa12b83';

const snapshot = buildRecordTableWidgetViewSnapshot(
  getMockObjectMetadataItemOrThrow('company'),
);

const relationTraversalViewFilter: FlatViewFilter = {
  id: 'view-filter-id',
  fieldMetadataId: SOURCE_FIELD_METADATA_ID,
  operand: ViewFilterOperand.IS,
  value: JSON.stringify({
    isCurrentRecordSelected: true,
    selectedRecordIds: [],
  }),
  viewFilterGroupId: null,
  positionInViewFilterGroup: null,
  subFieldName: null,
  relationTargetFieldMetadataId: RELATION_TARGET_FIELD_METADATA_ID,
  viewId: snapshot.view.id,
};

const recordTableWidget = {
  ...makeWidget(WIDGET_ID, 0),
  type: WidgetType.RECORD_TABLE,
  configuration: {
    __typename: 'RecordTableConfiguration' as const,
    configurationType: WidgetConfigurationType.RECORD_TABLE,
    viewId: snapshot.view.id,
  },
} as unknown as PageLayoutWidget;

const upsertViewWidgetResult = jest.fn(
  (variables: { input: UpsertViewWidgetInput }) => ({
    data: {
      upsertViewWidget: {
        __typename: 'View',
        id: variables.input.widgetId,
        viewGroups: [],
      },
    },
  }),
);

const mocks: MockedResponse[] = [
  {
    request: {
      query: UPSERT_VIEW_WIDGET,
      variables: () => true,
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: upsertViewWidgetResult,
  },
];

const getWrapper =
  (store: ReturnType<typeof createStore>) =>
  ({ children }: { children: ReactNode }) => (
    <JotaiProvider store={store}>
      <MockedProvider
        mocks={mocks}
        defaultOptions={{ mutate: { fetchPolicy: 'no-cache' } }}
      >
        {children}
      </MockedProvider>
    </JotaiProvider>
  );

describe('useSaveRecordTableWidgetViews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should include relationTargetFieldMetadataId in the upsert view filters input @custom', async () => {
    const store = createStore();

    store.set(
      pageLayoutDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
      makeDraft([makeTab('tab-1', [recordTableWidget])]),
    );
    store.set(
      recordTableWidgetViewDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
      {
        [WIDGET_ID]: {
          ...snapshot,
          viewFilters: [relationTraversalViewFilter],
        },
      },
    );

    const { result } = renderHook(() => useSaveRecordTableWidgetViews(), {
      wrapper: getWrapper(store),
    });

    await act(async () => {
      await result.current.saveRecordTableWidgetViews(PAGE_LAYOUT_ID);
    });

    expect(upsertViewWidgetResult).toHaveBeenCalledTimes(1);

    const { input } = upsertViewWidgetResult.mock.calls[0][0];

    expect(input.widgetId).toBe(WIDGET_ID);
    expect(input.viewFilters).toEqual([
      expect.objectContaining({
        id: relationTraversalViewFilter.id,
        fieldMetadataId: SOURCE_FIELD_METADATA_ID,
        relationTargetFieldMetadataId: RELATION_TARGET_FIELD_METADATA_ID,
      }),
    ]);
  });

  it('should send undefined relationTargetFieldMetadataId for direct filters', async () => {
    const store = createStore();

    store.set(
      pageLayoutDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
      makeDraft([makeTab('tab-1', [recordTableWidget])]),
    );
    store.set(
      recordTableWidgetViewDraftComponentState.atomFamily({
        instanceId: PAGE_LAYOUT_ID,
      }),
      {
        [WIDGET_ID]: {
          ...snapshot,
          viewFilters: [
            {
              ...relationTraversalViewFilter,
              relationTargetFieldMetadataId: null,
            },
          ],
        },
      },
    );

    const { result } = renderHook(() => useSaveRecordTableWidgetViews(), {
      wrapper: getWrapper(store),
    });

    await act(async () => {
      await result.current.saveRecordTableWidgetViews(PAGE_LAYOUT_ID);
    });

    expect(upsertViewWidgetResult).toHaveBeenCalledTimes(1);

    const { input } = upsertViewWidgetResult.mock.calls[0][0];

    expect(input.viewFilters?.[0].relationTargetFieldMetadataId).toBe(
      undefined,
    );
  });
});

it('saves and reloads FIELD widget grouping with its current-record junction filter @custom', async () => {
  const store = createStore();
  const objectMetadataItem = getMockObjectMetadataItemOrThrow('opportunity');
  const selectField = objectMetadataItem.readableFields.find(
    isFieldMetadataItemAvailableAsWidgetGroupByField,
  );

  if (!selectField?.options?.length) {
    throw new Error('Missing SELECT options fixture');
  }

  const initialSnapshot = {
    ...buildRecordTableWidgetViewSnapshot(objectMetadataItem),
    viewFilters: [relationTraversalViewFilter],
  };
  initialSnapshot.viewFilters = initialSnapshot.viewFilters.map((filter) => ({
    ...filter,
    viewId: initialSnapshot.view.id,
  }));

  const widget: PageLayoutWidget = {
    ...makeWidget(WIDGET_ID, 0),
    type: WidgetType.FIELD,
    configuration: {
      __typename: 'FieldConfiguration',
      configurationType: WidgetConfigurationType.FIELD,
      fieldMetadataId: SOURCE_FIELD_METADATA_ID,
      fieldDisplayMode: FieldDisplayMode.TABLE,
      viewId: initialSnapshot.view.id,
    },
  };
  const draftState = recordTableWidgetViewDraftComponentState.atomFamily({
    instanceId: PAGE_LAYOUT_ID,
  });
  const persistedState =
    recordTableWidgetViewPersistedComponentState.atomFamily({
      instanceId: PAGE_LAYOUT_ID,
    });

  store.set(
    pageLayoutDraftComponentState.atomFamily({ instanceId: PAGE_LAYOUT_ID }),
    makeDraft([makeTab('tab-1', [widget])]),
  );
  store.set(draftState, { [WIDGET_ID]: initialSnapshot });
  store.set(persistedState, { [WIDGET_ID]: initialSnapshot });

  const serverGroups = selectField.options.map((option, index) => ({
    id: `server-group-${index}`,
    viewId: initialSnapshot.view.id,
    fieldValue: option.value,
    position: index,
    isVisible: true,
  }));
  const saveResult = jest.fn((variables: { input: UpsertViewWidgetInput }) => ({
    data: {
      upsertViewWidget: {
        __typename: 'View',
        id: initialSnapshot.view.id,
        viewGroups: variables.input.view?.mainGroupByFieldMetadataId
          ? serverGroups
          : [],
      },
    },
  }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <JotaiProvider store={store}>
      <MockedProvider
        mocks={[
          {
            request: { query: UPSERT_VIEW_WIDGET, variables: () => true },
            maxUsageCount: Number.POSITIVE_INFINITY,
            result: saveResult,
          },
        ]}
        defaultOptions={{ mutate: { fetchPolicy: 'no-cache' } }}
      >
        {children}
      </MockedProvider>
    </JotaiProvider>
  );
  const { result } = renderHook(
    () => ({
      ...useSaveRecordTableWidgetViews(),
      ...useRecordTableWidgetLayoutCallbacks({
        pageLayoutId: PAGE_LAYOUT_ID,
        widgetId: WIDGET_ID,
      }),
    }),
    { wrapper },
  );

  for (const field of [selectField, null]) {
    act(() => result.current.handleGroupByFieldChange(field));
    await act(async () => {
      await result.current.saveRecordTableWidgetViews(PAGE_LAYOUT_ID);
    });

    const call = saveResult.mock.calls.at(-1);
    expect(call).toBeDefined();
    expect(call?.[0].input.view?.mainGroupByFieldMetadataId).toBe(
      field?.id ?? null,
    );
    expect(call?.[0].input.viewFilters).toEqual([
      expect.objectContaining({
        relationTargetFieldMetadataId: RELATION_TARGET_FIELD_METADATA_ID,
        value: relationTraversalViewFilter.value,
      }),
    ]);

    const savedSnapshot = store.get(persistedState)[WIDGET_ID];
    expect(savedSnapshot.viewGroups).toEqual(field ? serverGroups : []);

    const savedView =
      constructViewFromRecordTableWidgetViewSnapshot(savedSnapshot);
    const reloaded = buildMissingRecordTableWidgetViewDraftSnapshots({
      widgets: [widget],
      existingSnapshotsByWidgetId: {},
      views: [savedView],
    })[WIDGET_ID];

    expect(reloaded.view.mainGroupByFieldMetadataId).toBe(field?.id ?? null);
    expect(reloaded.viewGroups).toEqual(field ? serverGroups : []);
    expect(reloaded.viewFilters).toEqual(initialSnapshot.viewFilters);
    store.set(draftState, { [WIDGET_ID]: reloaded });
    store.set(persistedState, { [WIDGET_ID]: reloaded });
  }
  expect(saveResult).toHaveBeenCalledTimes(2);
});
