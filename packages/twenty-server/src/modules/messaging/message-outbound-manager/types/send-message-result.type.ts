import { type MessageRawContentInput } from 'src/modules/messaging/message-import-manager/types/message-raw-content-input.type';

export type SendMessageResult = {
  rawContent?: MessageRawContentInput;
  headerMessageId: string;
  messageExternalId?: string;
  threadExternalId?: string;
  deliveredRecipients?: { to: string[]; cc: string[]; bcc: string[] };
};
