import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useTemporaryFieldsConfiguration } from '@/page-layout/hooks/useTemporaryFieldsConfiguration';
import { FieldsConfigurationEditor } from '@/page-layout/widgets/fields/components/FieldsConfigurationEditor';
import { FieldsWidgetGroupsDraftInitializationEffect } from '@/page-layout/widgets/fields/components/FieldsWidgetGroupsDraftInitializationEffect';
import { usePageLayoutSidePanelTarget } from '@/side-panel/pages/page-layout/hooks/usePageLayoutSidePanelTarget';
import { useWidgetInEditMode } from '@/side-panel/pages/page-layout/hooks/useWidgetInEditMode';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme';
import {
  type FieldsConfiguration,
  WidgetConfigurationType,
} from '~/generated-metadata/graphql';

const StyledFieldsLayoutContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

export const SidePanelFieldsLayoutSubPage = () => {
  const { pageLayoutId, targetRecordIdentifier } =
    usePageLayoutSidePanelTarget();

  const { widgetInEditMode } = useWidgetInEditMode(pageLayoutId);
  const temporaryFieldsConfiguration = useTemporaryFieldsConfiguration();

  const { objectMetadataItems } = useObjectMetadataItems();
  const objectMetadataItem = objectMetadataItems.find(
    (objectMetadataItem) =>
      objectMetadataItem.id === widgetInEditMode?.objectMetadataId,
  );
  const objectNameSingular =
    objectMetadataItem?.nameSingular ??
    targetRecordIdentifier.targetObjectNameSingular;

  if (!isDefined(widgetInEditMode)) {
    return null;
  }

  const widgetConfiguration = widgetInEditMode.configuration;

  const resolvedFieldsConfiguration: FieldsConfiguration =
    isDefined(widgetConfiguration) &&
    (widgetConfiguration.configurationType === WidgetConfigurationType.FIELDS ||
      widgetConfiguration.configurationType ===
        WidgetConfigurationType.RELATED_RECORD_FIELDS)
      ? (widgetConfiguration as FieldsConfiguration)
      : temporaryFieldsConfiguration;

  return (
    <StyledFieldsLayoutContainer>
      <FieldsWidgetGroupsDraftInitializationEffect
        objectNameSingular={objectNameSingular}
        viewId={resolvedFieldsConfiguration.viewId ?? null}
        pageLayoutId={pageLayoutId}
        widgetId={widgetInEditMode.id}
      />
      <FieldsConfigurationEditor
        objectNameSingular={objectNameSingular}
        pageLayoutId={pageLayoutId}
        widgetId={widgetInEditMode.id}
      />
    </StyledFieldsLayoutContainer>
  );
};
