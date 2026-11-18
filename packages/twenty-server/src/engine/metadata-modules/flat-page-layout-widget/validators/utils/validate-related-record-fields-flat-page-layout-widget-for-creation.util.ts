import {
  FieldMetadataType,
  RelationType,
  PageLayoutType,
} from 'twenty-shared/types';
import { msg, t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { validate as uuidValidate } from 'uuid';

import { type ValidateFlatPageLayoutWidgetTypeSpecificitiesForCreationArgs } from 'src/engine/metadata-modules/flat-page-layout-widget/services/flat-page-layout-widget-type-validator.service';
import { type FlatPageLayoutWidgetValidationError } from 'src/engine/metadata-modules/flat-page-layout-widget/types/flat-page-layout-widget-validation-error.type';
import { WidgetConfigurationType } from 'src/engine/metadata-modules/page-layout-widget/enums/widget-configuration-type.type';
import { PageLayoutWidgetExceptionCode } from 'src/engine/metadata-modules/page-layout-widget/exceptions/page-layout-widget.exception';

export const validateRelatedRecordFieldsFlatPageLayoutWidgetForCreation = (
  args: ValidateFlatPageLayoutWidgetTypeSpecificitiesForCreationArgs,
): FlatPageLayoutWidgetValidationError[] => {
  const {
    flatEntityToValidate,
    optimisticFlatEntityMapsAndRelatedFlatEntityMaps,
  } = args;
  const { universalConfiguration, title: widgetTitle } = flatEntityToValidate;
  const errors: FlatPageLayoutWidgetValidationError[] = [];

  if (!isDefined(universalConfiguration)) {
    errors.push({
      code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
      message: t`Configuration is required for fields widget "${widgetTitle}"`,
      userFriendlyMessage: msg`Configuration is required for fields widget`,
    });

    return errors;
  }

  if (
    universalConfiguration.configurationType !==
    WidgetConfigurationType.RELATED_RECORD_FIELDS
  ) {
    const actualString =
      universalConfiguration.configurationType?.toString() ?? 'undefined';

    errors.push({
      code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
      message: t`Invalid configuration type for fields widget "${widgetTitle}". Expected RELATED_RECORD_FIELDS, got ${actualString}`,
      userFriendlyMessage: msg`Invalid configuration type for fields widget`,
      value: universalConfiguration.configurationType,
    });

    return errors;
  }

  const relationIdentifier =
    universalConfiguration.relationFieldMetadataUniversalIdentifier;
  const {
    flatFieldMetadataMaps,
    flatPageLayoutTabMaps,
    flatPageLayoutMaps,
    flatViewMaps,
  } = optimisticFlatEntityMapsAndRelatedFlatEntityMaps;
  const field =
    flatFieldMetadataMaps.byUniversalIdentifier[relationIdentifier ?? ''];
  const tab =
    flatPageLayoutTabMaps.byUniversalIdentifier[
      flatEntityToValidate.pageLayoutTabUniversalIdentifier ?? ''
    ];
  const pageLayout =
    flatPageLayoutMaps.byUniversalIdentifier[
      tab?.pageLayoutUniversalIdentifier ?? ''
    ];
  const view =
    flatViewMaps.byUniversalIdentifier[
      universalConfiguration.viewUniversalIdentifier ?? ''
    ];
  if (
    !isDefined(field) ||
    !field.isActive ||
    (field.type !== FieldMetadataType.RELATION &&
      field.type !== FieldMetadataType.MORPH_RELATION) ||
    !isDefined(field.universalSettings) ||
    !('relationType' in field.universalSettings) ||
    field.universalSettings.relationType !== RelationType.MANY_TO_ONE ||
    field.relationTargetObjectMetadataUniversalIdentifier !==
      flatEntityToValidate.objectMetadataUniversalIdentifier ||
    !isDefined(pageLayout) ||
    pageLayout.type !== PageLayoutType.RECORD_PAGE ||
    field.objectMetadataUniversalIdentifier !==
      pageLayout.objectMetadataUniversalIdentifier
  ) {
    errors.push({
      code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
      message:
        'Related record fields require a single-record relation from the page object to the widget object.',
      userFriendlyMessage: msg`Select a relation pointing to one record of the related object's type.`,
    });
  }
  if (
    !isDefined(view) ||
    view.objectMetadataUniversalIdentifier !==
      flatEntityToValidate.objectMetadataUniversalIdentifier
  ) {
    errors.push({
      code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
      message: 'Related record fields require a view of the related object.',
      userFriendlyMessage: msg`Select a field layout for the related object.`,
    });
  }

  for (const property of [
    'isReadOnly',
    'shouldAllowUserToSeeHiddenFields',
  ] as const) {
    const value = universalConfiguration[property];
    if (isDefined(value) && typeof value !== 'boolean') {
      errors.push({
        code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
        message: `Invalid ${property}: expected a boolean`,
        userFriendlyMessage: msg`Invalid related record fields setting`,
        value,
      });
    }
  }

  const newFieldDefaultVisibility = (
    universalConfiguration as {
      configurationType: string;
      newFieldDefaultVisibility?: unknown;
    }
  ).newFieldDefaultVisibility;

  if (
    isDefined(newFieldDefaultVisibility) &&
    typeof newFieldDefaultVisibility !== 'boolean'
  ) {
    errors.push({
      code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
      message: t`Invalid newFieldDefaultVisibility for fields widget "${widgetTitle}". Expected a boolean`,
      userFriendlyMessage: msg`Invalid newFieldDefaultVisibility for fields widget`,
      value: newFieldDefaultVisibility,
    });
  }

  const viewUniversalIdentifier = (
    universalConfiguration as {
      configurationType: string;
      viewUniversalIdentifier?: unknown;
    }
  ).viewUniversalIdentifier;

  if (isDefined(viewUniversalIdentifier) && viewUniversalIdentifier !== null) {
    if (
      typeof viewUniversalIdentifier !== 'string' ||
      !uuidValidate(viewUniversalIdentifier)
    ) {
      errors.push({
        code: PageLayoutWidgetExceptionCode.INVALID_PAGE_LAYOUT_WIDGET_DATA,
        message: t`Invalid viewUniversalIdentifier for fields widget "${widgetTitle}". Expected a valid UUID`,
        userFriendlyMessage: msg`Invalid viewUniversalIdentifier for fields widget`,
        value: viewUniversalIdentifier,
      });
    }
  }

  return errors;
};
