import { MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-channel-message-association-data-seeds.constant';
import { MESSAGE_DATA_SEEDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-data-seeds.constant';
import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';
import { buildGmailEmailSnapshot } from 'src/modules/messaging/message-import-manager/drivers/gmail/utils/build-gmail-email-snapshot.util';

type MessageRawContentDataSeed = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  messageId: string;
  messageChannelMessageAssociationId: string;
  provider: string;
  contentFormat: string;
  rawContent: string;
  metadata: null;
};

export const MESSAGE_RAW_CONTENT_DATA_SEED_COLUMNS: (keyof MessageRawContentDataSeed)[] =
  [
    'id',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'messageId',
    'messageChannelMessageAssociationId',
    'provider',
    'contentFormat',
    'rawContent',
    'metadata',
  ];

const GENERATE_MESSAGE_RAW_CONTENT_IDS = (): Record<string, string> =>
  Object.fromEntries(
    MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS.map((_, index) => [
      `ID_${index + 1}`,
      `20202020-${(index + 1).toString(16).padStart(4, '0')}-4e7d-8001-123456789bce`,
    ]),
  );

export const MESSAGE_RAW_CONTENT_DATA_SEED_IDS =
  GENERATE_MESSAGE_RAW_CONTENT_IDS();

export const getMessageRawContentDataSeeds = async (): Promise<
  MessageRawContentDataSeed[]
> => {
  const messagesById = new Map(
    MESSAGE_DATA_SEEDS.map((message) => [message.id, message]),
  );

  return Promise.all(
    MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS.map(
      async (association, index) => {
        const message = messagesById.get(association.messageId);

        if (!message) {
          throw new Error(`Missing message seed ${association.messageId}`);
        }

        const body = Buffer.from(message.text, 'utf8');

        return {
          id: MESSAGE_RAW_CONTENT_DATA_SEED_IDS[`ID_${index + 1}`],
          createdAt: association.createdAt,
          updatedAt: association.updatedAt,
          deletedAt: null,
          messageId: association.messageId,
          messageChannelMessageAssociationId: association.id,
          provider: 'gmail',
          contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
          rawContent: await buildGmailEmailSnapshot({
            payload: {
              partId: '',
              mimeType: 'text/plain',
              headers: [
                { name: 'Subject', value: message.subject },
                { name: 'Message-ID', value: message.headerMessageId },
                { name: 'Date', value: message.receivedAt.toUTCString() },
                { name: 'Content-Type', value: 'text/plain; charset=UTF-8' },
              ],
              body: { data: body.toString('base64url'), size: body.length },
            },
            messageId: association.messageExternalId,
            threadId: association.messageThreadExternalId,
          }),
          metadata: null,
        };
      },
    ),
  );
};
