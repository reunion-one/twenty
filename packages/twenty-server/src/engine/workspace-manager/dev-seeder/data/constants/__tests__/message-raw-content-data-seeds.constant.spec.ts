import { MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-channel-message-association-data-seeds.constant';
import { MESSAGE_DATA_SEEDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-data-seeds.constant';
import { getMessageRawContentDataSeeds } from 'src/engine/workspace-manager/dev-seeder/data/constants/message-raw-content-data-seeds.constant';
import { GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT } from 'src/modules/messaging/message-import-manager/drivers/gmail/constants/gmail-email-snapshot-content-format.constant';

describe('message raw content data seeds @custom', () => {
  it('creates a Gmail snapshot for every message channel association', async () => {
    const seeds = await getMessageRawContentDataSeeds();

    expect(seeds).toHaveLength(
      MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS.length,
    );
    expect(new Set(seeds.map(({ id }) => id)).size).toBe(seeds.length);

    for (const [index, seed] of seeds.entries()) {
      const association = MESSAGE_CHANNEL_MESSAGE_ASSOCIATION_DATA_SEEDS[index];
      const message = MESSAGE_DATA_SEEDS.find(
        ({ id }) => id === association.messageId,
      );

      expect(message).toBeDefined();
      expect(seed).toMatchObject({
        messageId: association.messageId,
        messageChannelMessageAssociationId: association.id,
        createdAt: association.createdAt,
        updatedAt: association.updatedAt,
        deletedAt: null,
        provider: 'gmail',
        contentFormat: GMAIL_EMAIL_SNAPSHOT_CONTENT_FORMAT,
        metadata: null,
      });

      const snapshot = JSON.parse(seed.rawContent);

      expect(snapshot).toMatchObject({
        schema: 'email-semantic-snapshot',
        source: {
          provider: 'gmail',
          message_id: association.messageExternalId,
          thread_id: association.messageThreadExternalId,
        },
        mime: { content_type: 'text/plain', externalized: false },
      });
      expect(
        Buffer.from(snapshot.mime.body_base64, 'base64').toString('utf8'),
      ).toBe(message?.text);
    }
  });
});
