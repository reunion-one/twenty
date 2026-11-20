import { AiSystemPromptOverrideResolver } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/resolvers/ai-system-prompt-override.resolver';
import { Module } from '@nestjs/common';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';
import { AiSystemPromptOverrideService } from 'src/engine/metadata-modules/ai/ai-system-prompt-override/services/ai-system-prompt-override.service';

@Module({
  imports: [KeyValuePairModule],
  providers: [AiSystemPromptOverrideService, AiSystemPromptOverrideResolver],
  exports: [AiSystemPromptOverrideService],
})
export class AiSystemPromptOverrideModule {}
