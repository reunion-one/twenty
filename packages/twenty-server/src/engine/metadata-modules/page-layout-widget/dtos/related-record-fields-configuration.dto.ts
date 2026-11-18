import { Field, ObjectType } from '@nestjs/graphql';

import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  type RelatedRecordFieldsConfiguration,
  type SerializedRelation,
} from 'twenty-shared/types';

import { WidgetConfigurationType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-configuration-type.type';

@ObjectType('RelatedRecordFieldsConfiguration')
export class RelatedRecordFieldsConfigurationDTO implements RelatedRecordFieldsConfiguration {
  @Field(() => WidgetConfigurationType)
  @IsIn([WidgetConfigurationType.RELATED_RECORD_FIELDS])
  @IsNotEmpty()
  configurationType: WidgetConfigurationType.RELATED_RECORD_FIELDS;

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
