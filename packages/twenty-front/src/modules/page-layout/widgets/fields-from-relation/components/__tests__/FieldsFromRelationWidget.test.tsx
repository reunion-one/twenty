import { FieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidget';
import { createDefaultFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/createDefaultFieldsFromRelationWidget';
import { render, screen } from '@testing-library/react';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getTestEnrichedObjectMetadataItemsMock } from '~/testing/utils/getTestEnrichedObjectMetadataItemsMock';

const mockPerson = getMockObjectMetadataItemOrThrow('person');
const mockCompany = getMockObjectMetadataItemOrThrow('company');
const mockObjects = getTestEnrichedObjectMetadataItemsMock();
const mockCompanyField = mockPerson.readableFields.find(
  (field) => field.name === 'company',
)!;
let mockPointedRecordId: string | null = 'company-record';
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
  () => ({ useAtomFamilySelectorValue: () => mockPointedRecordId }),
);
jest.mock(
  '@/object-record/record-store/hooks/useRecordRestrictedFieldNames',
  () => ({ useRecordRestrictedFieldNames: () => mockRestrictedNames }),
);
jest.mock(
  '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetRecord',
  () => ({
    FieldsFromRelationWidgetRecord: ({
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
  const widget = createDefaultFieldsFromRelationWidget({
    id: 'widget',
    pageLayoutTabId: 'tab',
    positionIndex: 0,
    objectMetadataId: mockCompany.id,
  });
  if (widget.configuration.__typename !== 'FieldsFromRelationConfiguration') {
    throw new Error('Missing related fields configuration');
  }
  return {
    ...widget,
    configuration: { ...widget.configuration, relationFieldMetadataId },
  };
};

describe('FieldsFromRelationWidget @custom', () => {
  beforeEach(() => {
    mockPointedRecordId = 'company-record';
    mockRestrictedNames = [];
    mockSourceReadable = true;
  });

  it('loads exactly the selected related object and record', () => {
    render(<FieldsFromRelationWidget widget={makeWidget()} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'company:company-record',
    );
  });

  it('renders no body until a relation is configured', () => {
    const { container } = render(
      <FieldsFromRelationWidget widget={makeWidget('')} />,
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
    if (scenario === 'no link') {
      mockPointedRecordId = null;
    }
    if (scenario === 'record restricted') {
      mockRestrictedNames = ['company'];
    }
    if (scenario === 'source unreadable') {
      mockSourceReadable = false;
    }
    const { container } = render(
      <FieldsFromRelationWidget
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
      createDefaultFieldsFromRelationWidget({
        id: 'widget',
        pageLayoutTabId: 'tab',
        positionIndex: 0,
        objectMetadataId: mockPerson.id,
      }).configuration,
    ).toMatchObject({ viewId: null, relationFieldMetadataId: '' });
  });
});
