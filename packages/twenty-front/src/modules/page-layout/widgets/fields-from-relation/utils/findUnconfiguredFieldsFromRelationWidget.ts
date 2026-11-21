import { type DraftPageLayout } from '@/page-layout/types/DraftPageLayout';
import { isNonEmptyString } from '@sniptt/guards';
import { WidgetType } from '~/generated-metadata/graphql';

export const findUnconfiguredFieldsFromRelationWidget = (
  draft: DraftPageLayout | undefined,
) =>
  draft?.tabs
    .flatMap((tab) => tab.widgets)
    .find(
      (widget) =>
        widget.type === WidgetType.FIELDS_FROM_RELATION &&
        (widget.configuration.__typename !==
          'FieldsFromRelationConfiguration' ||
          !isNonEmptyString(widget.configuration.relationFieldMetadataId) ||
          !isNonEmptyString(widget.configuration.viewId)),
    );
