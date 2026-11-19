import { Field, ObjectType } from '@nestjs/graphql';

import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  type FieldsFromRelationConfiguration,
  type SerializedRelation,
} from 'twenty-shared/types';

import { WidgetConfigurationType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-configuration-type.type';

@ObjectType('FieldsFromRelationConfiguration')
export class FieldsFromRelationConfigurationDTO implements FieldsFromRelationConfiguration {
  @Field(() => WidgetConfigurationType)
  @IsIn([WidgetConfigurationType.FIELDS_FROM_RELATION])
  @IsNotEmpty()
  configurationType: WidgetConfigurationType.FIELDS_FROM_RELATION;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isReadOnly?: boolean;

  @Field(() => String)
  @IsUUID()
  relationFieldMetadataId: SerializedRelation;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  viewId: SerializedRelation | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  newFieldDefaultVisibility: boolean | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  shouldAllowUserToSeeHiddenFields?: boolean;
}
