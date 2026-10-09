import { ConnectedAccountProvider } from 'twenty-shared/types';

import { MicrosoftFetchByBatchService } from 'src/modules/messaging/message-import-manager/drivers/microsoft/services/microsoft-fetch-by-batch.service';
import { type MicrosoftGraphBatchResponse } from 'src/modules/messaging/message-import-manager/drivers/microsoft/services/microsoft-get-messages.interface';
import { MicrosoftMessagesImportErrorHandler } from 'src/modules/messaging/message-import-manager/drivers/microsoft/services/microsoft-messages-import-error-handler.service';
import { MicrosoftGetMessagesService } from 'src/modules/messaging/message-import-manager/drivers/microsoft/services/microsoft-get-messages.service';

describe('MicrosoftGetMessagesService @custom', () => {
  it('keeps each original Graph message body as raw provider data', () => {
    const service = new MicrosoftGetMessagesService(
      {
        fetchAllByBatches: jest.fn(),
      } as unknown as MicrosoftFetchByBatchService,
      {
        handleError: jest.fn(),
      } as unknown as MicrosoftMessagesImportErrorHandler,
    );
    const providerMessage = {
      id: 'graph-message-1',
      internetMessageId: '<graph-message-1@example.com>',
      receivedDateTime: '2026-10-01T10:00:00.000Z',
      conversationId: 'graph-conversation-1',
      subject: 'Original subject',
      body: { contentType: 'text', content: 'Original body' },
      from: {
        emailAddress: {
          name: 'Sender',
          address: 'sender@example.com',
        },
      },
      toRecipients: [
        {
          emailAddress: {
            name: 'Recipient',
            address: 'me@example.com',
          },
        },
      ],
      providerSpecificValue: { preserved: true },
    };
    const batchResponse: MicrosoftGraphBatchResponse = {
      responses: [{ id: '1', status: 200, body: providerMessage }],
    };

    const messages = service.formatBatchResponsesAsMessages([batchResponse], {
      id: 'connected-account-id',
      provider: ConnectedAccountProvider.MICROSOFT,
      handle: 'me@example.com',
      handleAliases: [],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].rawProviderData).toBe(providerMessage);
  });
});
