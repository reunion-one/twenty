import { DEFAULT_VIEW_GROUP_LOAD_LIMIT } from 'twenty-shared/constants';
import {
  FieldMetadataType,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';

import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';
import { fromUpdateViewInputToFlatViewToUpdateOrThrow } from 'src/engine/metadata-modules/flat-view/utils/from-update-view-input-to-flat-view-to-update-or-throw.util';
import { handleFlatViewUpdateSideEffect } from 'src/engine/metadata-modules/flat-view/utils/handle-flat-view-update-side-effect.util';

const APPLICATION_UNIVERSAL_IDENTIFIER = '20202020-aaaa-4aaa-8aaa-000000000001';
const WORKSPACE_CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER =
  '20202020-bbbb-4bbb-8bbb-000000000002';
const VIEW_ID = '20202020-cccc-4ccc-8ccc-000000000003';
const COMPANY_FIELD_ID = '20202020-dddd-4ddd-8ddd-000000000004';
const STAGE_FIELD_ID = '20202020-eeee-4eee-8eee-000000000005';
const OBJECT_METADATA_ID = '20202020-ffff-4fff-8fff-000000000006';

const stageOptions = Array.from({ length: 14 }, (_, position) => ({
  value: `STAGE_${position}`,
  label: `Stage ${position}`,
  position,
  color: 'blue',
}));

const flatFieldMetadataMaps = [
  getFlatFieldMetadataMock({
    id: STAGE_FIELD_ID,
    universalIdentifier: STAGE_FIELD_ID,
    objectMetadataId: OBJECT_METADATA_ID,
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    type: FieldMetadataType.SELECT,
    isNullable: false,
    options: stageOptions,
  }),
  getFlatFieldMetadataMock({
    id: COMPANY_FIELD_ID,
    universalIdentifier: COMPANY_FIELD_ID,
    objectMetadataId: OBJECT_METADATA_ID,
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    type: FieldMetadataType.RELATION,
    isNullable: true,
  }),
].reduce<FlatEntityMaps<FlatFieldMetadata>>(
  (flatEntityMaps, flatEntity) =>
    addFlatEntityToFlatEntityMapsOrThrow({ flatEntity, flatEntityMaps }),
  createEmptyFlatEntityMaps(),
);

const view: FlatView = {
  id: VIEW_ID,
  universalIdentifier: VIEW_ID,
  name: 'By Stage',
  type: ViewType.TABLE_WIDGET,
  applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  applicationId: APPLICATION_UNIVERSAL_IDENTIFIER,
  workspaceId: WORKSPACE_CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
  objectMetadataId: OBJECT_METADATA_ID,
  objectMetadataUniversalIdentifier: OBJECT_METADATA_ID,
  icon: 'IconTable',
  key: null,
  position: 0,
  isCompact: false,
  isActive: true,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  visibility: ViewVisibility.WORKSPACE,
  createdByUserWorkspaceId: null,
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
  deletedAt: null,
  kanbanAggregateOperation: null,
  kanbanAggregateOperationFieldMetadataId: null,
  kanbanAggregateOperationFieldMetadataUniversalIdentifier: null,
  calendarLayout: null,
  calendarFieldMetadataId: null,
  calendarFieldMetadataUniversalIdentifier: null,
  calendarEndFieldMetadataId: null,
  calendarEndFieldMetadataUniversalIdentifier: null,
  anyFieldFilterValue: null,
  shouldHideEmptyGroups: false,
  shouldDisplayGroupsAsTabs: false,
  kanbanColumnWidth: null,
  groupLoadLimit: DEFAULT_VIEW_GROUP_LOAD_LIMIT,
  isSystemSideEffect: false,
  mainGroupByFieldMetadataId: STAGE_FIELD_ID,
  mainGroupByFieldMetadataUniversalIdentifier: STAGE_FIELD_ID,
  overrides: null,
  universalOverrides: null,
  viewGroupIds: [],
  viewGroupUniversalIdentifiers: [],
  viewFieldIds: [],
  viewFieldUniversalIdentifiers: [],
  viewFieldGroupIds: [],
  viewFieldGroupUniversalIdentifiers: [],
  viewFilterIds: [],
  viewFilterUniversalIdentifiers: [],
  viewFilterGroupIds: [],
  viewFilterGroupUniversalIdentifiers: [],
  viewSortIds: [],
  viewSortUniversalIdentifiers: [],
  navigationMenuItemIds: [],
  navigationMenuItemUniversalIdentifiers: [],
};

describe('handleFlatViewUpdateSideEffect missing groups @custom', () => {
  const update = (fromFlatView: FlatView) =>
    handleFlatViewUpdateSideEffect({
      fromFlatView,
      toFlatView: { ...fromFlatView },
      flatViewGroupMaps: createEmptyFlatEntityMaps(),
      flatFieldMetadataMaps,
      flatFieldMetadataOptionMaps: createEmptyFlatEntityMaps(),
    });

  it('repairs missing SELECT groups with an unchanged widget grouping', () => {
    const result = fromUpdateViewInputToFlatViewToUpdateOrThrow({
      updateViewInput: {
        id: VIEW_ID,
        mainGroupByFieldMetadataId: STAGE_FIELD_ID,
      },
      flatViewMaps: addFlatEntityToFlatEntityMapsOrThrow({
        flatEntity: view,
        flatEntityMaps: createEmptyFlatEntityMaps(),
      }),
      flatViewGroupMaps: createEmptyFlatEntityMaps(),
      flatFieldMetadataMaps,
      flatFieldMetadataOptionMaps: createEmptyFlatEntityMaps(),
      callerApplicationUniversalIdentifier:
        WORKSPACE_CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
      workspaceCustomApplicationUniversalIdentifier:
        WORKSPACE_CUSTOM_APPLICATION_UNIVERSAL_IDENTIFIER,
    });
    expect(result.flatViewGroupsToDelete).toEqual([]);
    expect(
      result.flatViewGroupsToCreate.map((group) => group.fieldValue),
    ).toEqual(stageOptions.map((option) => option.value));
  });

  it.each([
    ['non-widget view', { ...view, type: ViewType.TABLE }],
    [
      'non-SELECT field',
      { ...view, mainGroupByFieldMetadataId: COMPANY_FIELD_ID },
    ],
    ['existing groups', { ...view, viewGroupIds: ['existing-group-id'] }],
  ])('does not repair %s', (_label, unchangedView) => {
    expect(update(unchangedView)).toEqual({
      flatViewGroupsToCreate: [],
      flatViewGroupsToDelete: [],
    });
  });
});
