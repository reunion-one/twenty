import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  FieldMetadataType,
  PageLayoutType,
  WidgetType,
  RelationOnDeleteAction,
  RelationType,
  ViewKey,
  ViewType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { PLATFORM_WRITTEN_DISABLED_OBJECT_PERMISSION_ACTIONS } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-disabled-object-permission-actions.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';

const WORKSPACE_ID = '20202020-1111-4111-8111-111111111111';
const TWENTY_STANDARD_APPLICATION_ID = '20202020-2222-4222-8222-222222222222';
const NOW = '2024-01-01T00:00:00.000Z';

describe('messageRawContent standard metadata @custom', () => {
  const { allFlatEntityMaps } =
    computeTwentyStandardApplicationAllFlatEntityMaps({
      now: NOW,
      workspaceId: WORKSPACE_ID,
      twentyStandardApplicationId: TWENTY_STANDARD_APPLICATION_ID,
    });
  const fields = STANDARD_OBJECTS.messageRawContent.fields;
  const findField = (universalIdentifier: string) =>
    allFlatEntityMaps.flatFieldMetadataMaps.byUniversalIdentifier[
      universalIdentifier
    ];

  it('defines a system object with platform-written permissions and an id label', () => {
    const idField = findField(fields.id.universalIdentifier);

    expect(idField).toBeDefined();
    expect(
      allFlatEntityMaps.flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.messageRawContent.universalIdentifier
      ],
    ).toMatchObject({
      nameSingular: 'messageRawContent',
      namePlural: 'messageRawContents',
      isSystem: true,
      isSearchable: false,
      isAuditLogged: false,
      isUICreatable: false,
      isUIEditable: false,
      labelIdentifierFieldMetadataId: idField?.id,
      disabledObjectPermissionActions:
        PLATFORM_WRITTEN_DISABLED_OBJECT_PERMISSION_ACTIONS,
    });
  });

  it('provides nullable text envelope fields and JSON metadata', () => {
    for (const fieldName of [
      'provider',
      'contentFormat',
      'rawContent',
    ] as const) {
      expect(findField(fields[fieldName].universalIdentifier)).toMatchObject({
        type: FieldMetadataType.TEXT,
        isNullable: true,
      });
    }
    expect(findField(fields.metadata.universalIdentifier)).toMatchObject({
      type: FieldMetadataType.RAW_JSON,
      isNullable: true,
    });
  });

  it('belongs to a message with a cascading inverse relation', () => {
    const targetObject =
      allFlatEntityMaps.flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.message.universalIdentifier
      ];
    const relation = findField(fields.message.universalIdentifier);
    const inverse = findField(
      STANDARD_OBJECTS.message.fields.messageRawContents.universalIdentifier,
    );

    expect(targetObject).toBeDefined();
    expect(inverse).toBeDefined();
    expect(relation).toMatchObject({
      type: FieldMetadataType.RELATION,
      isNullable: false,
      relationTargetObjectMetadataId: targetObject?.id,
      relationTargetFieldMetadataId: inverse?.id,
      settings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: RelationOnDeleteAction.CASCADE,
        joinColumnName: 'messageId',
      },
    });
    expect(inverse).toMatchObject({
      type: FieldMetadataType.RELATION,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECTS.messageRawContent.universalIdentifier,
      relationTargetFieldMetadataId: relation?.id,
      settings: { relationType: RelationType.ONE_TO_MANY },
    });
  });

  it('belongs to a messageChannelMessageAssociation with a cascading inverse relation', () => {
    const targetObject =
      allFlatEntityMaps.flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.messageChannelMessageAssociation.universalIdentifier
      ];
    const relation = findField(
      fields.messageChannelMessageAssociation.universalIdentifier,
    );
    const inverse = findField(
      STANDARD_OBJECTS.messageChannelMessageAssociation.fields
        .messageRawContents.universalIdentifier,
    );

    expect(targetObject).toBeDefined();
    expect(inverse).toBeDefined();
    expect(relation).toMatchObject({
      type: FieldMetadataType.RELATION,
      isNullable: false,
      relationTargetObjectMetadataId: targetObject?.id,
      relationTargetFieldMetadataId: inverse?.id,
      settings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: RelationOnDeleteAction.CASCADE,
        joinColumnName: 'messageChannelMessageAssociationId',
      },
    });
    expect(inverse).toMatchObject({
      type: FieldMetadataType.RELATION,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECTS.messageRawContent.universalIdentifier,
      relationTargetFieldMetadataId: relation?.id,
      settings: { relationType: RelationType.ONE_TO_MANY },
    });
  });

  it('indexes only the association uniquely and the message non-uniquely', () => {
    for (const [indexName, fieldName, isUnique] of [
      [
        'messageChannelMessageAssociationIdUniqueIndex',
        'messageChannelMessageAssociation',
        true,
      ],
      ['messageIdIndex', 'message', false],
    ] as const) {
      const index =
        allFlatEntityMaps.flatIndexMaps.byUniversalIdentifier[
          STANDARD_OBJECTS.messageRawContent.indexes[indexName]
            .universalIdentifier
        ];
      const field = findField(fields[fieldName].universalIdentifier);

      expect(field).toBeDefined();
      expect(field?.settings).toMatchObject({
        joinColumnName: `${fieldName}Id`,
      });
      expect(index).toMatchObject({ isUnique });
      expect(
        index?.flatIndexFieldMetadatas.map(
          (indexField) => indexField.fieldMetadataId,
        ),
      ).toEqual([field?.id]);
    }
  });

  it('provides exactly one index table view with all raw content columns in order', () => {
    const views = Object.values(
      allFlatEntityMaps.flatViewMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter(
        (view) =>
          view.objectMetadataUniversalIdentifier ===
            STANDARD_OBJECTS.messageRawContent.universalIdentifier &&
          view.key === ViewKey.INDEX,
      );

    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({
      type: ViewType.TABLE,
      key: ViewKey.INDEX,
      position: 0,
      icon: 'IconTable',
    });

    const viewFields = Object.values(
      allFlatEntityMaps.flatViewFieldMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter((viewField) => viewField.viewId === views[0].id)
      .sort((first, second) => first.position - second.position);
    const fieldNames = [
      'message',
      'messageChannelMessageAssociation',
      'provider',
      'contentFormat',
      'rawContent',
      'metadata',
      'updatedAt',
      'createdAt',
    ] as const;

    expect(viewFields.map((viewField) => viewField.fieldMetadataId)).toEqual(
      fieldNames.map(
        (fieldName) => findField(fields[fieldName].universalIdentifier)?.id,
      ),
    );
    for (const viewField of viewFields) {
      expect(viewField).toMatchObject({ isVisible: true, size: 150 });
    }
  });

  it('provides a Home-only record page whose fields widget covers all raw content fields', () => {
    const layouts = Object.values(
      allFlatEntityMaps.flatPageLayoutMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter(
        (layout) =>
          layout.objectMetadataUniversalIdentifier ===
            STANDARD_OBJECTS.messageRawContent.universalIdentifier &&
          layout.type === PageLayoutType.RECORD_PAGE,
      );

    expect(layouts).toHaveLength(1);

    const tabs = Object.values(
      allFlatEntityMaps.flatPageLayoutTabMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter((tab) => tab.pageLayoutId === layouts[0].id);

    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({ title: 'Home' });

    const widgets = Object.values(
      allFlatEntityMaps.flatPageLayoutWidgetMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter((widget) => widget.pageLayoutTabId === tabs[0].id);
    const view =
      allFlatEntityMaps.flatViewMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.messageRawContent.views
          .messageRawContentRecordPageFields.universalIdentifier
      ];

    expect(view).toBeDefined();
    expect(view).toMatchObject({ type: ViewType.FIELDS_WIDGET, key: null });
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      type: WidgetType.FIELDS,
      configuration: { viewId: view?.id },
    });

    const viewFields = Object.values(
      allFlatEntityMaps.flatViewFieldMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter((viewField) => viewField.viewId === view?.id);
    const fieldNames = [
      'message',
      'messageChannelMessageAssociation',
      'provider',
      'contentFormat',
      'rawContent',
      'metadata',
      'createdAt',
      'updatedAt',
      'createdBy',
    ] as const;

    expect(
      viewFields.map((viewField) => viewField.fieldMetadataId).sort(),
    ).toEqual(
      fieldNames
        .map(
          (fieldName) => findField(fields[fieldName].universalIdentifier)?.id,
        )
        .sort(),
    );
  });

  it('keeps raw content out of all standard message views and record page fields', () => {
    const rawContentsField = findField(
      STANDARD_OBJECTS.message.fields.messageRawContents.universalIdentifier,
    );
    const messageViews = Object.values(
      allFlatEntityMaps.flatViewMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter(
        (view) =>
          view.objectMetadataUniversalIdentifier ===
          STANDARD_OBJECTS.message.universalIdentifier,
      );
    const messageViewIds = messageViews.map((view) => view.id);
    const messageViewFields = Object.values(
      allFlatEntityMaps.flatViewFieldMaps.byUniversalIdentifier,
    )
      .filter(isDefined)
      .filter((viewField) => messageViewIds.includes(viewField.viewId));

    expect(rawContentsField).toBeDefined();
    expect(messageViews.length).toBeGreaterThan(0);
    expect(messageViewFields.length).toBeGreaterThan(0);
    for (const viewField of messageViewFields) {
      expect(viewField.fieldMetadataId).not.toBe(rawContentsField?.id);
    }
  });
});
