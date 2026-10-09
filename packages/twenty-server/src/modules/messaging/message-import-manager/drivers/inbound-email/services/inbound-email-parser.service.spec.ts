import { InboundEmailParserService } from 'src/modules/messaging/message-import-manager/drivers/inbound-email/services/inbound-email-parser.service';

describe('InboundEmailParserService raw provider data @custom', () => {
  it('keeps exact MIME bytes for SES and Resend messages', async () => {
    const rawMessage = Buffer.from(
      'From: sender@example.com\r\nTo: me@example.com\r\nMessage-ID: <inbound-1@example.com>\r\nSubject: Original\r\n\r\nBody',
    );
    const service = new InboundEmailParserService();

    const result = await service.parse(rawMessage, 'provider-reference');

    expect(result.message.rawProviderData).toEqual({
      encoding: 'base64',
      data: rawMessage.toString('base64'),
    });
    const encodedData = result.message.rawProviderData?.data;

    if (typeof encodedData !== 'string') {
      throw new Error('Expected raw MIME data to be a base64 string');
    }

    expect(Buffer.from(encodedData, 'base64')).toEqual(rawMessage);
  });
});
