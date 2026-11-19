import { useQuery } from '@apollo/client/react';
import { renderHook } from '@testing-library/react';

import { useGettingStartedProgress } from '@/getting-started/hooks/useGettingStartedProgress';
import { GettingStartedProgressDocument } from '~/generated-metadata/graphql';

jest.mock('@apollo/client/react', () => ({
  useQuery: jest.fn(() => ({
    data: { gettingStartedProgress: { isHidden: false } },
    loading: false,
    error: undefined,
    refetch: jest.fn(),
  })),
}));

describe('useGettingStartedProgress @custom', () => {
  it('skips the query and does not expose cached progress while disabled', () => {
    const { result } = renderHook(() => useGettingStartedProgress());

    expect(useQuery).toHaveBeenCalledWith(GettingStartedProgressDocument, {
      skip: true,
    });
    expect(result.current.progress).toBeUndefined();
  });
});
