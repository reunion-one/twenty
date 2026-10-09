import { MESSAGE_GQL_FIELDS } from 'test/integration/constants/message-gql-fields.constants';
import { findManyOperationFactory } from 'test/integration/graphql/utils/find-many-operation-factory.util';
import { findOneOperationFactory } from 'test/integration/graphql/utils/find-one-operation-factory.util';
import { makeGraphqlApiRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { updateOneOperationFactory } from 'test/integration/graphql/utils/update-one-operation-factory.util';
import { QUERY_MAX_RECORDS } from 'twenty-shared/constants';

import { MESSAGE_DATA_SEED_IDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-data-seeds.constant';

describe('messagesResolver (e2e)', () => {
  it('should find many messages', async () => {
    const graphqlOperation = findManyOperationFactory({
      objectMetadataSingularName: 'message',
      objectMetadataPluralName: 'messages',
      gqlFields: MESSAGE_GQL_FIELDS,
    });

    const response = await makeGraphqlApiRequest(graphqlOperation);

    const data = response.body.data.messages;

    expect(data).toBeDefined();
    expect(Array.isArray(data.edges)).toBe(true);

    const edges = data.edges;

    expect(edges.length).toEqual(QUERY_MAX_RECORDS);

    const message1 = edges[0].node;

    expect(message1).toMatchSnapshot({
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('should find one message', async () => {
    const graphqlOperation = findOneOperationFactory({
      objectMetadataSingularName: 'message',
      filter: { id: { eq: MESSAGE_DATA_SEED_IDS.ID_1 } },
      gqlFields: MESSAGE_GQL_FIELDS,
    });

    const response = await makeGraphqlApiRequest(graphqlOperation);

    const data = response.body.data.message;

    expect(data).toBeDefined();
    expect(data).toMatchSnapshot({
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('does not expose raw provider fields to general Message mutations @custom', async () => {
    const response = await makeGraphqlApiRequest(
      updateOneOperationFactory({
        objectMetadataSingularName: 'message',
        recordId: MESSAGE_DATA_SEED_IDS.ID_1,
        gqlFields: 'id',
        data: {
          rawProviderData: { providerPayload: 'must stay system managed' },
        },
      }),
    );

    expect(response.body.errors).toBeDefined();
    const errorMessages = response.body.errors
      ?.map((error: { message: string }) => error.message)
      .join(' ');

    expect(errorMessages).toContain('rawProviderData');
  });
});
