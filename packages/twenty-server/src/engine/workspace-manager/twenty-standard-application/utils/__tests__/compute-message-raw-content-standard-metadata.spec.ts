import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  FieldMetadataType,
  RelationOnDeleteAction,
  RelationType,
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
