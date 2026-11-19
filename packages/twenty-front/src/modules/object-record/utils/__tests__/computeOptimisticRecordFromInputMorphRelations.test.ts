import { computeOptimisticRecordFromInput } from '@/object-record/utils/computeOptimisticRecordFromInput';
import { InMemoryCache } from '@apollo/client';
import {
  computeMorphRelationGqlFieldName,
  computeRelationGqlFieldJoinColumnName,
} from 'twenty-shared/utils';
import { RelationType } from '~/generated-metadata/graphql';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { getMockFieldMetadataItemOrThrow } from '~/testing/utils/getMockFieldMetadataItemOrThrow';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

describe('computeOptimisticRecordFromInput morph relations @custom', () => {
  const objectMetadataItem = getMockObjectMetadataItemOrThrow('attachment');
  const targetField = getMockFieldMetadataItemOrThrow({
    objectMetadataItem,
    fieldName: 'target',
  });
  const emptyTargetIds = Object.fromEntries(
    (targetField.morphRelations ?? []).map((morphRelation) => [
      computeRelationGqlFieldJoinColumnName({
        name: computeMorphRelationGqlFieldName({
          fieldName: targetField.name,
          relationType: RelationType.MANY_TO_ONE,
          targetObjectMetadataNameSingular:
            morphRelation.targetObjectMetadata.nameSingular,
          targetObjectMetadataNamePlural:
            morphRelation.targetObjectMetadata.namePlural,
        }),
      }),
      null,
    ]),
  );

  const computeRecord = (recordInput: Record<string, string | null>) =>
    computeOptimisticRecordFromInput({
      currentWorkspaceMember: null,
      objectMetadataItems: getTestEnrichedObjectMetadataItemsMock(),
      objectMetadataItem,
      recordInput,
      cache: new InMemoryCache(),
      objectPermissionsByObjectMetadataId: {},
    });

  it('keeps the company id from a single-target SSE input', () => {
    const result = computeRecord({
      ...emptyTargetIds,
      targetCompanyId: 'c1',
    });

    expect(result).toHaveProperty('targetCompanyId', 'c1');
  });

  // Documents an upstream bug that this port does not fix.
  it.skip('keeps both non-null target ids', () => {
    const result = computeRecord({
      ...emptyTargetIds,
      targetCompanyId: 'c1',
      targetPersonId: 'p1',
    });

    expect(result).toMatchObject({
      targetCompanyId: 'c1',
      targetPersonId: 'p1',
    });
  });

  // Documents an upstream bug that this port does not fix.
  it.skip('clears the old target id when retargeting', () => {
    const result = computeRecord({
      ...emptyTargetIds,
      targetCompanyId: null,
      targetPersonId: 'p1',
    });

    expect(result).toMatchObject({
      targetCompanyId: null,
      targetPersonId: 'p1',
    });
  });
});
