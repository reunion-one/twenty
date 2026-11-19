import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { buildDraftPageLayoutWidget } from '@/page-layout/utils/buildDraftPageLayoutWidget';
import { t } from '@lingui/core/macro';
import {
  PageLayoutTabLayoutMode,
  WidgetConfigurationType,
  WidgetType,
} from '~/generated-metadata/graphql';

export const createDefaultFieldsFromRelationWidget = ({
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
    title: t`Fields from relation`,
    type: WidgetType.FIELDS_FROM_RELATION,
    configuration: {
      __typename: 'FieldsFromRelationConfiguration',
      configurationType: WidgetConfigurationType.FIELDS_FROM_RELATION,
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
