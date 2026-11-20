import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AiToolAvailability')
export class AiToolAvailabilityDTO {
  @Field(() => String)
  toolIdentifier: string;

  @Field(() => String, { nullable: true })
  toolName: string | null;

  @Field(() => Boolean)
  isAgentEnabled: boolean;

  @Field(() => Boolean)
  isMcpEnabled: boolean;
}
