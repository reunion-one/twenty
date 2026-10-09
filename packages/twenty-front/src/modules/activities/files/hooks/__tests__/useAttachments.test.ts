import { renderHook } from '@testing-library/react';

import { useAttachments } from '@/activities/files/hooks/useAttachments';

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));
jest.mock('@/sse-db-event/hooks/useListenToEventsForQuery', () => ({
  useListenToEventsForQuery: jest.fn(),
}));

describe('useAttachments @custom', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches readable attachment fields for one target and refetches on reconnect', async () => {
    const mockAttachments = [
      { id: '1', name: 'Attachment 1' },
      { id: 2, name: 'Attachment 2' },
    ];
    const mockTargetableObject = {
      id: '1',
      targetObjectNameSingular: 'SomeObject',
    };

    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );
    const useListenToEventsForQueryMock = jest.requireMock(
      '@/sse-db-event/hooks/useListenToEventsForQuery',
    );
    const refetch = jest.fn();
    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: mockAttachments,
      refetch,
    });

    const { result } = renderHook(() => useAttachments(mockTargetableObject));

    expect(result.current.attachments).toEqual(mockAttachments);
    expect(useFindManyRecordsMock.useFindManyRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { targetSomeObjectId: { eq: '1' } },
        recordGqlFields: {
          id: true,
          name: true,
          file: true,
          createdAt: true,
          docType: true,
        },
      }),
    );

    const eventSubscription =
      useListenToEventsForQueryMock.useListenToEventsForQuery.mock.calls[0][0];
    expect(eventSubscription).toMatchObject({
      queryId: 'attachments-SomeObject-1',
      operationSignature: {
        variables: { filter: { targetSomeObjectId: { eq: '1' } } },
        fields: { docType: true },
      },
    });
    await eventSubscription.onSseReconnected();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('handles case when there are no attachments', () => {
    const mockTargetableObject = {
      id: '1',
      targetObjectNameSingular: 'SomeObject',
    };

    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );
    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({ records: [] });

    const { result } = renderHook(() => useAttachments(mockTargetableObject));

    expect(result.current.attachments).toEqual([]);
  });
});
