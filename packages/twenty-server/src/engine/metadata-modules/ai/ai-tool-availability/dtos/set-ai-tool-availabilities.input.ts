import { Field, InputType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { SetAiToolAvailabilityInput } from 'src/engine/metadata-modules/ai/ai-tool-availability/dtos/set-ai-tool-availability.input';

@InputType()
export class SetAiToolAvailabilitiesInput {
  @Field(() => [SetAiToolAvailabilityInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetAiToolAvailabilityInput)
  items: SetAiToolAvailabilityInput[];
}
