import { generateFindManyRecordsQuery } from '@/object-record/utils/generateFindManyRecordsQuery';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getDefaultObjectPermissions } from '@/object-metadata/utils/getDefaultObjectPermissions';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const attachmentMetadata = getTestEnrichedObjectMetadataItemsMock().find(
  (item) => item.nameSingular === 'attachment',
);

const documentTypeField: FieldMetadataItem = {
  id: 'doc-type-field-id',
  name: 'docType',
  label: 'Document type',
  type: FieldMetadataType.SELECT,
  isActive: true,
  isNullable: true,
  options: [],
} as unknown as FieldMetadataItem;

const generateAttachmentQuery = (
  readableField: FieldMetadataItem | undefined,
) => {
  const objectMetadataItem = {
    ...attachmentMetadata,
    fields: [...(attachmentMetadata?.fields ?? []), documentTypeField],
    readableFields: [
      ...(attachmentMetadata?.readableFields ?? []),
      ...(readableField ? [readableField] : []),
    ],
  } as EnrichedObjectMetadataItem;

  return generateFindManyRecordsQuery({
    objectMetadataItem,
    objectMetadataItems: [objectMetadataItem],
    recordGqlFields: { docType: true },
    objectPermissionsByObjectMetadataId: {
      [objectMetadataItem.id]: getDefaultObjectPermissions(
        objectMetadataItem.id,
      ),
    },
  });
};

describe('useAttachments generated query fields @custom', () => {
  it('includes active readable docType when the query requests it', () => {
    const query = generateAttachmentQuery(documentTypeField);

    expect(query.loc?.source.body).toContain('docType');
  });

  it.each([
    { label: 'unreadable', field: undefined },
    { label: 'inactive', field: { ...documentTypeField, isActive: false } },
  ])('omits $label docType metadata from the generated query', ({ field }) => {
    const query = generateAttachmentQuery(field);

    expect(query.loc?.source.body).not.toContain('docType');
  });
});
