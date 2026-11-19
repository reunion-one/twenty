import { render } from '@testing-library/react';
import { AttachmentsSSESubscribeEffect } from '@/activities/files/components/AttachmentsSSESubscribeEffect';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useRefetchFindManyRecords } from '@/object-record/hooks/useRefetchFindManyRecords';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';

jest.mock('@/object-metadata/hooks/useObjectMetadataItem');
jest.mock('@/object-record/hooks/useRefetchFindManyRecords');
jest.mock('@/sse-db-event/hooks/useListenToEventsForQuery');

describe('AttachmentsSSESubscribeEffect @custom', () => {
  const targetRecord = {
    id: 'company-id',
    targetObjectNameSingular: 'company',
  };
  const refetchFindManyRecords = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useObjectMetadataItem).mockReturnValue({
      objectMetadataItem: getMockObjectMetadataItemOrThrow('attachment'),
    });
    jest
      .mocked(useRefetchFindManyRecords)
      .mockReturnValue({ refetchFindManyRecords });
  });

  it('registers an attachment listener filtered by the target id without narrowing fields', () => {
    render(<AttachmentsSSESubscribeEffect targetRecord={targetRecord} />);

    expect(useListenToEventsForQuery).toHaveBeenCalledWith({
      queryId: 'attachments-company-company-id',
      operationSignature: {
        objectNameSingular: 'attachment',
        variables: { filter: { targetCompanyId: { eq: 'company-id' } } },
      },
      onSseReconnected: refetchFindManyRecords,
    });
    expect(
      jest.mocked(useListenToEventsForQuery).mock.calls[0][0]
        .operationSignature,
    ).not.toHaveProperty('fields');
  });

  it('refetches attachment queries on reconnect', async () => {
    render(<AttachmentsSSESubscribeEffect targetRecord={targetRecord} />);
    const subscription = jest.mocked(useListenToEventsForQuery).mock
      .calls[0][0];

    await subscription.onSseReconnected?.();

    expect(useRefetchFindManyRecords).toHaveBeenCalledWith({
      objectMetadataNamePlural: 'attachments',
    });
    expect(refetchFindManyRecords).toHaveBeenCalledTimes(1);
  });
});
