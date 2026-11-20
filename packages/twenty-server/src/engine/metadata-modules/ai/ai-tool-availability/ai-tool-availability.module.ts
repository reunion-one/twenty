import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';
import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { AiToolAvailabilityService } from 'src/engine/metadata-modules/ai/ai-tool-availability/services/ai-tool-availability.service';
import { AiToolAvailabilityCleanupListener } from 'src/engine/metadata-modules/ai/ai-tool-availability/listeners/ai-tool-availability-cleanup.listener';

@Module({
  imports: [
    KeyValuePairModule,
    WorkspaceCacheModule,
    TypeOrmModule.forFeature([KeyValuePairEntity]),
  ],
  providers: [AiToolAvailabilityService, AiToolAvailabilityCleanupListener],
  exports: [AiToolAvailabilityService],
})
export class AiToolAvailabilityModule {}
