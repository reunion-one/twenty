import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { type MetadataEventBatch } from 'src/engine/subscriptions/metadata-event/types/metadata-event-batch.type';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';

@Injectable()
export class AiToolAvailabilityCleanupListener {
  private readonly logger = new Logger(AiToolAvailabilityCleanupListener.name);
  constructor(
    private readonly aiToolAvailabilityService: AiToolAvailabilityService,
  ) {}

  @OnEvent('metadata.logicFunction.deleted')
  @OnEvent('metadata.objectMetadata.deleted')
  @OnEvent('metadata.mcpServer.deleted')
  async handleDeleted({
    workspaceId,
    metadataName,
    events,
  }: MetadataEventBatch): Promise<void> {
    for (const { recordId } of events) {
      try {
        switch (metadataName) {
          case 'logicFunction':
            await this.aiToolAvailabilityService.set(
              workspaceId,
              `logicFunction:${recordId}`,
              { isAgentEnabled: true, isMcpEnabled: true },
            );
            break;
          case 'objectMetadata':
            await this.aiToolAvailabilityService.deleteByKeyPrefix(
              workspaceId,
              `object:${recordId}:`,
            );
            break;
          case 'mcpServer':
            await this.aiToolAvailabilityService.deleteByKeyPrefix(
              workspaceId,
              `mcpServer:${recordId}:`,
            );
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to clean tool availability for ${metadataName} ${recordId} in workspace ${workspaceId}`,
          error,
        );
      }
    }
  }
}
