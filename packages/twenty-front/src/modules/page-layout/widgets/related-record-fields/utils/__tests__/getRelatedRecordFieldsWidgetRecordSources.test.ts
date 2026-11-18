import { getRelatedRecordFieldsWidgetRecordSources } from '@/page-layout/widgets/related-record-fields/utils/getRelatedRecordFieldsWidgetRecordSources';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { RelationType } from '~/generated-metadata/graphql';

const objects = getTestEnrichedObjectMetadataItemsMock();
const person = getMockObjectMetadataItemOrThrow('person');
const company = getMockObjectMetadataItemOrThrow('company');

describe('getRelatedRecordFieldsWidgetRecordSources @custom', () => {
  it('offers a person’s company, but never a company’s people collection', () => {
    expect(getRelatedRecordFieldsWidgetRecordSources(person, objects)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldName: 'company',
          objectMetadataItem: expect.objectContaining({ id: company.id }),
        }),
      ]),
    );
    expect(
      getRelatedRecordFieldsWidgetRecordSources(company, objects).some(
        (source) => source.fieldName === 'people',
      ),
    ).toBe(false);
  });

  it('does not offer unreadable or inactive relations or missing target objects', () => {
    expect(
      getRelatedRecordFieldsWidgetRecordSources(
        { ...person, readableFields: [] },
        objects,
      ),
    ).toEqual([]);
    expect(
      getRelatedRecordFieldsWidgetRecordSources(
        {
          ...person,
          readableFields: person.readableFields.map((field) => ({
            ...field,
            isActive: false,
          })),
        },
        objects,
      ),
    ).toEqual([]);
    expect(getRelatedRecordFieldsWidgetRecordSources(person, [])).toEqual([]);
  });

  it('offers individual single-record morph targets using their concrete ids and query names', () => {
    const field = person.readableFields.find((item) => item.name === 'company');
    if (!field?.relation) throw new Error('Expected company fixture relation');
    const source = {
      ...person,
      readableFields: [
        {
          ...field,
          name: 'owner',
          relation: null,
          morphRelations: [
            { ...field.relation, type: RelationType.MANY_TO_ONE },
          ],
        },
      ],
    };
    expect(getRelatedRecordFieldsWidgetRecordSources(source, objects)).toEqual([
      expect.objectContaining({
        fieldName: 'ownerCompany',
        fieldMetadataId: field.relation.sourceFieldMetadata.id,
      }),
    ]);
  });
});
