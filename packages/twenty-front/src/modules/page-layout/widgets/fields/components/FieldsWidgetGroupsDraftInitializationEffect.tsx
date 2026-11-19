import { useContextStoreObjectMetadataItemOrThrow } from '@/context-store/hooks/useContextStoreObjectMetadataItemOrThrow';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useFieldsWidgetEditorGroupsData } from '@/page-layout/widgets/fields/hooks/useFieldsWidgetEditorGroupsData';
import { useInitializeFieldsWidgetGroupsDraft } from '@/page-layout/widgets/fields/hooks/useInitializeFieldsWidgetGroupsDraft';

type FieldsWidgetGroupsDraftInitializationEffectProps = {
  viewId: string | null;
  objectNameSingular?: string;
  pageLayoutId: string;
  widgetId: string;
};

export const FieldsWidgetGroupsDraftInitializationEffect = ({
  viewId,
  objectNameSingular,
  pageLayoutId,
  widgetId,
}: FieldsWidgetGroupsDraftInitializationEffectProps) => {
  const { objectMetadataItem: contextObjectMetadataItem } =
    useContextStoreObjectMetadataItemOrThrow();
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular:
      objectNameSingular ?? contextObjectMetadataItem.nameSingular,
  });

  const {
    groups: persistedGroups,
    ungroupedFields,
    editorMode,
  } = useFieldsWidgetEditorGroupsData({
    viewId,
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  useInitializeFieldsWidgetGroupsDraft({
    pageLayoutId,
    widgetId,
    persistedGroups,
    persistedUngroupedFields: ungroupedFields,
    persistedEditorMode: editorMode,
  });

  return null;
};
