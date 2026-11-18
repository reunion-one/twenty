import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { buildDraftPageLayoutWidget } from '@/page-layout/utils/buildDraftPageLayoutWidget';
import { t } from '@lingui/core/macro';
import {
  PageLayoutTabLayoutMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';

export const createDefaultRelatedRecordFieldsWidget = ({
  id,
  pageLayoutTabId,
  objectMetadataId,
  positionIndex,
}: {
  id: string;
  pageLayoutTabId: string;
  objectMetadataId: string;
  positionIndex: number;
}): PageLayoutWidget =>
  buildDraftPageLayoutWidget({
    id,
    pageLayoutTabId,
    title: t`Related record fields`,
    type: WidgetType.RELATED_RECORD_FIELDS,
    configuration: {
      __typename: 'RelatedRecordFieldsConfiguration',
      configurationType: WidgetConfigurationType.RELATED_RECORD_FIELDS,
      viewId: null,
      relationFieldMetadataId: '',
      isReadOnly: false,
      newFieldDefaultVisibility: true,
    },
    position: {
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      index: positionIndex,
    },
    objectMetadataId,
  });
