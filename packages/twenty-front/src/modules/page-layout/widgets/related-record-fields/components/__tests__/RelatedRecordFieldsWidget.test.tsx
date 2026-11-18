import { RelatedRecordFieldsWidget } from '@/page-layout/widgets/related-record-fields/components/RelatedRecordFieldsWidget';
import { createDefaultRelatedRecordFieldsWidget } from '@/page-layout/widgets/related-record-fields/utils/createDefaultRelatedRecordFieldsWidget';
import { render, screen } from '@testing-library/react';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';

const mockPerson = getMockObjectMetadataItemOrThrow('person');
const mockCompany = getMockObjectMetadataItemOrThrow('company');
const mockObjects = getTestEnrichedObjectMetadataItemsMock();
const mockCompanyField = mockPerson.readableFields.find(
  (field) => field.name === 'company',
)!;
let mockLinkedRecordId: string | null = 'company-record';
let mockRestrictedNames: string[] = [];
let mockSourceReadable = true;

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: () => ({
    objectMetadataItem: {
      ...mockPerson,
      readableFields: mockSourceReadable ? mockPerson.readableFields : [],
    },
  }),
}));
jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({ objectMetadataItems: mockObjects }),
}));
jest.mock('@/ui/layout/contexts/useTargetRecord', () => ({
  useTargetRecord: () => ({
    id: 'person-record',
    targetObjectNameSingular: 'person',
  }),
}));
jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue',
  () => ({ useAtomFamilySelectorValue: () => mockLinkedRecordId }),
);
jest.mock(
  '@/object-record/record-store/hooks/useRecordRestrictedFieldNames',
  () => ({ useRecordRestrictedFieldNames: () => mockRestrictedNames }),
);
jest.mock(
  '@/page-layout/widgets/related-record-fields/components/RelatedRecordFieldsWidgetRecord',
  () => ({
    RelatedRecordFieldsWidgetRecord: ({
      objectNameSingular,
      recordId,
    }: {
      objectNameSingular: string;
      recordId: string;
    }) => (
      <div role="status">
        {objectNameSingular}:{recordId}
      </div>
    ),
  }),
);

const makeWidget = (relationFieldMetadataId = mockCompanyField.id) => {
  const widget = createDefaultRelatedRecordFieldsWidget({
    id: 'widget',
    pageLayoutTabId: 'tab',
    positionIndex: 0,
    objectMetadataId: mockCompany.id,
  });
  if (widget.configuration.__typename !== 'RelatedRecordFieldsConfiguration')
    throw new Error('Missing related fields configuration');
  return {
    ...widget,
    configuration: { ...widget.configuration, relationFieldMetadataId },
  };
};

describe('RelatedRecordFieldsWidget @custom', () => {
  beforeEach(() => {
    mockLinkedRecordId = 'company-record';
    mockRestrictedNames = [];
    mockSourceReadable = true;
  });

  it('loads exactly the selected related object and record', () => {
    render(<RelatedRecordFieldsWidget widget={makeWidget()} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'company:company-record',
    );
  });

  it('renders no body until a relation is configured', () => {
    const { container } = render(
      <RelatedRecordFieldsWidget widget={makeWidget('')} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    'no link',
    'record restricted',
    'source unreadable',
    'invalid relation',
  ])('does not load the linked record for %s', (scenario) => {
    if (scenario === 'no link') mockLinkedRecordId = null;
    if (scenario === 'record restricted') mockRestrictedNames = ['company'];
    if (scenario === 'source unreadable') mockSourceReadable = false;
    const { container } = render(
      <RelatedRecordFieldsWidget
        widget={makeWidget(
          scenario === 'invalid relation' ? 'unknown' : mockCompanyField.id,
        )}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not allocate a fields view until a source is selected', () => {
    expect(
      createDefaultRelatedRecordFieldsWidget({
        id: 'widget',
        pageLayoutTabId: 'tab',
        positionIndex: 0,
        objectMetadataId: mockPerson.id,
      }).configuration,
    ).toMatchObject({ viewId: null, relationFieldMetadataId: '' });
  });
});
