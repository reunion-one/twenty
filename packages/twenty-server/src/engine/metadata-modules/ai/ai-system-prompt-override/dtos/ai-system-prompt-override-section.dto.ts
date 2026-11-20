import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AiSystemPromptOverrideSection')
export class AiSystemPromptOverrideSectionDTO {
  @Field(() => String)
  sectionKey: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  defaultTemplate: string;

  @Field(() => String, { nullable: true })
  overrideContent: string | null;

  @Field(() => Boolean)
  isDefaultChanged: boolean;
}
