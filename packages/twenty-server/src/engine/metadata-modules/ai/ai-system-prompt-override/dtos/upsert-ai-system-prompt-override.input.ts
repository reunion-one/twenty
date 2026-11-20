import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class UpsertAiSystemPromptOverrideInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  sectionKey: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  content: string;
}
