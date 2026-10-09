import { formatRawMimeMessage } from 'src/modules/messaging/message-import-manager/utils/format-raw-mime-message.util';

describe('formatRawMimeMessage @custom', () => {
  it('preserves every MIME byte in the base64 JSON representation', () => {
    const rawMessage = Buffer.from([0, 255, 13, 10, 0, 65, 128]);

    const result = formatRawMimeMessage(rawMessage);

    expect(result.encoding).toBe('base64');
    expect(Buffer.from(result.data, 'base64')).toEqual(rawMessage);
  });
});
