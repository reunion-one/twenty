import { FieldsFromRelationWidgetRecord } from '@/page-layout/widgets/fields-from-relation/components/FieldsFromRelationWidgetRecord';
import {
  LayoutRenderingProvider,
  useLayoutRenderingContext,
} from '@/ui/layout/contexts/LayoutRenderingContext';
import { render, screen } from '@testing-library/react';
import { PageLayoutType } from '~/generated-metadata/graphql';

const mockFindOneRecord = jest.fn();
const mockUpsertRecordsInStore = jest.fn();
jest.mock('@/object-record/hooks/useFindOneRecord', () => ({
  useFindOneRecord: (args: unknown) => mockFindOneRecord(args),
}));
jest.mock('@/object-record/record-store/hooks/useUpsertRecordsInStore', () => ({
  useUpsertRecordsInStore: () => ({
    upsertRecordsInStore: mockUpsertRecordsInStore,
  }),
}));
jest.mock('@/page-layout/widgets/components/WidgetSkeletonLoader', () => ({
  WidgetSkeletonLoader: () => <div role="status">Native widget skeleton</div>,
}));

jest.mock(
  '@/page-layout/widgets/components/PageLayoutWidgetErrorDisplay',
  () => ({
    PageLayoutWidgetErrorDisplay: () => (
      <div role="alert">Native widget error</div>
    ),
  }),
);

const Target = () => {
  const { targetRecordIdentifier } = useLayoutRenderingContext();
  return (
    <div>
      {targetRecordIdentifier?.targetObjectNameSingular}:
      {targetRecordIdentifier?.id}
    </div>
  );
};
const renderRelated = () =>
  render(
    <LayoutRenderingProvider
      value={{
        layoutType: PageLayoutType.RECORD_PAGE,
        targetRecordIdentifier: {
          id: 'person-id',
          targetObjectNameSingular: 'person',
        },
      }}
    >
      <FieldsFromRelationWidgetRecord
        widgetId="widget-id"
        objectNameSingular="company"
        recordId="company-id"
      >
        <Target />
      </FieldsFromRelationWidgetRecord>
      <Target />
    </LayoutRenderingProvider>,
  );

describe('FieldsFromRelationWidgetRecord @custom', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('loads the linked record and changes context only inside the widget', () => {
    const record = { id: 'company-id', name: 'Company' };
    mockFindOneRecord.mockReturnValue({ record, loading: false });
    renderRelated();
    expect(screen.getByText('company:company-id')).toBeVisible();
    expect(screen.getByText('person:person-id')).toBeVisible();
    expect(mockUpsertRecordsInStore).toHaveBeenCalledWith({
      partialRecords: [record],
    });
    expect(mockFindOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'company',
      objectRecordId: 'company-id',
    });
  });
  it('waits for the linked record instead of rendering parent data', () => {
    mockFindOneRecord.mockReturnValue({ loading: true });
    renderRelated();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Native widget skeleton',
    );
    expect(screen.queryByText('company:company-id')).toBeNull();
  });
  it('does not render fields when the linked record is unavailable', () => {
    mockFindOneRecord.mockReturnValue({ loading: false });
    renderRelated();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('person:person-id')).toBeVisible();
    expect(screen.queryByText('No record')).not.toBeInTheDocument();
    expect(screen.queryByText('company:company-id')).toBeNull();
  });
  it('uses the native widget error display on a failed load', () => {
    mockFindOneRecord.mockReturnValue({
      error: new Error('Failed'),
      loading: false,
      refetch: jest.fn(),
    });
    renderRelated();
    expect(screen.getByRole('alert')).toHaveTextContent('Native widget error');
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
  });
});
