import { isNonEmptyString } from '@sniptt/guards';
import { type gmail_v1 } from 'googleapis';
import { isDefined } from 'twenty-shared/utils';

import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';
import { buildGmailEmailSnapshot } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/build-gmail-email-snapshot.util';
import { decodeGmailBase64Url } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/decode-gmail-base64-url.util';
import { type MessageRawContentInput } from 'src/modules/messaging/message-import-manager/types/message-raw-content-input.type';

export const buildGmailMessageRawContent = async ({
  gmailClient,
  message,
}: {
  gmailClient: gmail_v1.Gmail;
  message: gmail_v1.Schema$Message;
}): Promise<MessageRawContentInput> => {
  const { id: messageId, threadId, payload } = message;

  if (
    !isNonEmptyString(messageId) ||
    !isNonEmptyString(threadId) ||
    !isDefined(payload)
  ) {
    throw new Error('Gmail message id, threadId and payload are required');
  }

  const content = await buildGmailEmailSnapshot({
    payload,
    messageId,
    threadId,
    loadInlineBody: async (attachmentId) => {
      const response = await gmailClient.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      });

      if (!isNonEmptyString(response.data.data)) {
        throw new Error('Gmail inline body attachment data is required');
      }

      try {
        return decodeGmailBase64Url(response.data.data);
      } catch {
        throw new Error(
          `invalid Gmail inline body attachment encoding for ${attachmentId}`,
        );
      }
    },
  });

  return {
    provider: 'gmail',
    contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
    content,
    metadata: null,
  };
};
