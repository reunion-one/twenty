import { Module } from '@nestjs/common';

import { ToolProviderModule } from 'src/engine/core-modules/tool-provider/tool-provider.module';
import { AiToolAvailabilityModule } from 'src/engine/metadata-modules/ai/ai-tool-availability/ai-tool-availability.module';
import { AiToolAvailabilityResolver } from 'src/engine/metadata-modules/ai/ai-tool-availability/resolvers/ai-tool-availability.resolver';

@Module({
  imports: [AiToolAvailabilityModule, ToolProviderModule],
  providers: [AiToolAvailabilityResolver],
})
export class AiToolAvailabilityApiModule {}
