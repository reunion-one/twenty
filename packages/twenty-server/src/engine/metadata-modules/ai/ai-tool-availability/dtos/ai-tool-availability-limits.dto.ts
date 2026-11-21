import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('AiToolAvailabilityLimits')
export class AiToolAvailabilityLimitsDTO {
  @Field(() => [String])
  neverAvailableToAgents: string[];

  @Field(() => [String])
  neverAvailableOverMcp: string[];
}
