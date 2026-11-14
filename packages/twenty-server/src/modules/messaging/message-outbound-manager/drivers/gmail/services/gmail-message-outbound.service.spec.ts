import { Logger } from '@nestjs/common';
import { type gmail_v1, google, type people_v1 } from 'googleapis';

import { type ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { type GoogleOAuth2ClientProvider } from 'src/modules/connected-account/oauth2-client-manager/drivers/google/google-oauth2-client.provider';
import { GmailMessageOutboundService } from 'src/modules/messaging/message-outbound-manager/drivers/gmail/services/gmail-message-outbound.service';

jest.mock('googleapis', () => ({
  google: { gmail: jest.fn(), people: jest.fn() },
}));

describe('GmailMessageOutboundService raw content @custom', () => {
  const get = jest.fn();
  const send = jest.fn();
  const getAttachment = jest.fn();
  const gmailClient = {
    users: {
      messages: { get, send, attachments: { get: getAttachment } },
      settings: {
        sendAs: {
          list: jest.fn().mockResolvedValue({
            data: {
              sendAs: [
                { sendAsEmail: 'sender@example.com', displayName: 'Sender' },
              ],
            },
          }),
        },
      },
    },
  };
  const provider = { getClient: jest.fn().mockResolvedValue({}) };
  const service = new GmailMessageOutboundService(
    provider as unknown as GoogleOAuth2ClientProvider,
  );
  const sendMessage = () =>
    service.sendMessage(
      {
        to: 'recipient@example.com',
        subject: 'Hello',
        body: 'Hello',
        html: '<p>Hello</p>',
      },
      {
        id: 'account-1',
        handle: 'sender@example.com',
      } as ConnectedAccountEntity,
    );

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest
      .mocked(google.gmail)
      .mockReturnValue(gmailClient as unknown as gmail_v1.Gmail);
    jest.mocked(google.people).mockReturnValue({} as people_v1.People);
    send.mockResolvedValue({ data: { id: 'message-1', threadId: 'thread-1' } });
    get.mockResolvedValue({
      data: {
        id: 'message-1',
        threadId: 'thread-1',
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'Message-ID', value: '<assigned@gmail.com>' }],
          body: { data: Buffer.from('Hello').toString('base64url') },
        },
      },
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers();
  });

  it('returns the assigned header and raw content from one full message read after send', async () => {
    const result = await sendMessage();

    expect(result.headerMessageId).toBe('<assigned@gmail.com>');
    expect(result.rawContent?.provider).toBe('gmail');
    expect(JSON.parse(result.rawContent!.content).source).toMatchObject({
      message_id: 'message-1',
      thread_id: 'thread-1',
    });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith({ userId: 'me', id: 'message-1' });
    expect(send.mock.invocationCallOrder[0]).toBeLessThan(
      get.mock.invocationCallOrder[0],
    );
  });

  it('keeps the assigned header when loading the raw content fails', async () => {
    get.mockResolvedValue({
      data: {
        id: 'message-1',
        threadId: 'thread-1',
        payload: {
          mimeType: 'text/plain',
          headers: [{ name: 'Message-ID', value: '<assigned@gmail.com>' }],
          body: { attachmentId: 'inline-body-1' },
        },
      },
    });
    getAttachment.mockRejectedValue(new Error('Attachment fetch failed'));

    const result = await sendMessage();

    expect(result.headerMessageId).toBe('<assigned@gmail.com>');
    expect(result).not.toHaveProperty('rawContent');
    expect(get).toHaveBeenCalledTimes(1);
    expect(getAttachment).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('Attachment fetch failed'),
    );
  });

  it.each(['get', 'snapshot'])(
    'keeps the sent result when %s fails',
    async (failure) => {
      if (failure === 'get') {
        get.mockRejectedValue(new Error('Fetch failed'));
      } else {
        get.mockResolvedValue({
          data: { id: 'message-1', threadId: 'thread-1' },
        });
      }

      const result = await sendMessage();
      const sentRaw = send.mock.calls[0][0].requestBody.raw as string;
      const sentMessage = Buffer.from(sentRaw, 'base64url').toString();

      expect(result.headerMessageId).toBe(
        sentMessage.match(/^Message-ID: (.+)$/im)?.[1].trim(),
      );
      expect(result).not.toHaveProperty('rawContent');
      expect(Logger.prototype.warn).toHaveBeenCalled();
    },
  );
});
