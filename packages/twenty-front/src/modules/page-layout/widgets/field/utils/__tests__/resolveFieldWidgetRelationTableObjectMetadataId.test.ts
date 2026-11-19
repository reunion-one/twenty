import { resolveFieldWidgetJunctionConfig } from '@/page-layout/widgets/field/utils/resolveFieldWidgetJunctionConfig';
import { resolveFieldWidgetRelationTableObjectMetadataId } from '@/page-layout/widgets/field/utils/resolveFieldWidgetRelationTableObjectMetadataId';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';

const objectMetadataItems = getTestEnrichedObjectMetadataItemsMock();
const personObjectMetadataItem = getMockObjectMetadataItemOrThrow('person');
const companyObjectMetadataItem = getMockObjectMetadataItemOrThrow('company');
const junctionObjectMetadataItem =
  getMockObjectMetadataItemOrThrow('employmentHistory');
const sourceField = personObjectMetadataItem.fields.find(
  (field) => field.name === 'previousCompanies',
);

if (!sourceField) {
  throw new Error('Missing junction source field fixture');
}

const junctionConfig = resolveFieldWidgetJunctionConfig({
  fieldMetadataItem: sourceField,
  objectMetadataItems,
});

if (!junctionConfig?.isValid) {
  throw new Error('Invalid junction fixture');
}

const junctionArgs = {
  relationObjectMetadataId: junctionObjectMetadataItem.id,
  junctionConfig,
};

describe('resolveFieldWidgetRelationTableObjectMetadataId @custom', () => {
  it('uses far-side metadata for a junction view, matching the rendered table', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        ...junctionArgs,
        viewObjectMetadataId: companyObjectMetadataItem.id,
      }),
    ).toBe(companyObjectMetadataItem.id);
  });

  it('uses the far side before a newly created view is persisted', () => {
    expect(resolveFieldWidgetRelationTableObjectMetadataId(junctionArgs)).toBe(
      companyObjectMetadataItem.id,
    );
  });

  it('retains a view intentionally listing junction rows', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        ...junctionArgs,
        viewObjectMetadataId: junctionObjectMetadataItem.id,
      }),
    ).toBe(junctionObjectMetadataItem.id);
  });

  it('rejects an unrelated backing view', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        ...junctionArgs,
        viewObjectMetadataId: personObjectMetadataItem.id,
      }),
    ).toBeUndefined();
  });

  it('rejects an invalid junction instead of falling back to junction fields', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        relationObjectMetadataId: junctionObjectMetadataItem.id,
        junctionConfig: {
          isValid: false,
          direction: 'forward',
          isMorphRelation: false,
          targetFields: [],
        },
      }),
    ).toBeUndefined();
  });

  it('retains direct relation behavior', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        relationObjectMetadataId: companyObjectMetadataItem.id,
        viewObjectMetadataId: companyObjectMetadataItem.id,
      }),
    ).toBe(companyObjectMetadataItem.id);
  });

  it('preserves explicit nested relation precedence', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        ...junctionArgs,
        nestedRelationFieldMetadataId: 'nested-field-id',
        nestedRelationTargetObjectMetadataId: personObjectMetadataItem.id,
      }),
    ).toBe(personObjectMetadataItem.id);
  });

  it('does not fall back when an explicit nested chain is broken', () => {
    expect(
      resolveFieldWidgetRelationTableObjectMetadataId({
        ...junctionArgs,
        nestedRelationFieldMetadataId: 'deleted-field-id',
      }),
    ).toBeUndefined();
  });
});
