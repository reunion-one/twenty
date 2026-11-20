import { Field, InputType } from '@nestjs/graphql';

import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class SetAiToolAvailabilityInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  toolIdentifier: string;

  @IsBoolean()
  @Field(() => Boolean)
  isAgentEnabled: boolean;

  @IsBoolean()
  @Field(() => Boolean)
  isMcpEnabled: boolean;
}
