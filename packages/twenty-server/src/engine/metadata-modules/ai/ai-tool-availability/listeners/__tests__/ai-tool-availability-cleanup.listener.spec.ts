import { Logger } from '@nestjs/common';
import { AiToolAvailabilityCleanupListener } from 'src/engine/metadata-modules/ai/ai-tool-availability/listeners/ai-tool-availability-cleanup.listener';
import { type AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';
import { type MetadataEventBatch } from 'src/engine/subscriptions/metadata-event/types/metadata-event-batch.type';

describe('@custom AiToolAvailabilityCleanupListener', () => {
  const service = { set: jest.fn(), deleteByKeyPrefix: jest.fn() };
  const listener = new AiToolAvailabilityCleanupListener(
    service as unknown as AiToolAvailabilityService,
  );
  const batch = (
    metadataName: MetadataEventBatch['metadataName'],
  ): MetadataEventBatch =>
    ({
      workspaceId: 'workspace',
      name: `metadata.${metadataName}.deleted`,
      metadataName,
      type: 'deleted',
      events: ['first', 'second'].map((recordId) => ({
        recordId,
        metadataName,
        type: 'deleted',
        properties: { before: {} },
      })),
    }) as MetadataEventBatch;
  beforeEach(() => jest.resetAllMocks());
  it('deletes exact logic function keys for every record', async () => {
    await listener.handleDeleted(batch('logicFunction'));
    for (const recordId of ['first', 'second']) {
      expect(service.set).toHaveBeenCalledWith(
        'workspace',
        `logicFunction:${recordId}`,
        { isAgentEnabled: true, isMcpEnabled: true },
      );
    }
    expect(service.deleteByKeyPrefix).not.toHaveBeenCalled();
  });
  it.each([
    ['objectMetadata', 'object'],
    ['mcpServer', 'mcpServer'],
  ] as const)(
    'deletes %s prefixes in the batch workspace',
    async (metadataName, prefix) => {
      await listener.handleDeleted(batch(metadataName));
      for (const recordId of ['first', 'second']) {
        expect(service.deleteByKeyPrefix).toHaveBeenCalledWith(
          'workspace',
          `${prefix}:${recordId}:`,
        );
      }
    },
  );
  it('logs failures and continues cleanup without rejecting the triggering delete', async () => {
    const error = new Error('repository failed');
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    service.deleteByKeyPrefix.mockRejectedValueOnce(error);
    await expect(
      listener.handleDeleted(batch('mcpServer')),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('first'), error);
    expect(service.deleteByKeyPrefix).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});
