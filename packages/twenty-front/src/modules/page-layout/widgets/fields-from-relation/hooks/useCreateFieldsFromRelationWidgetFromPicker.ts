import { useInsertCreatedWidgetAtContext } from '@/page-layout/hooks/useInsertCreatedWidgetAtContext';
import { pageLayoutDraftComponentState } from '@/page-layout/states/pageLayoutDraftComponentState';
import { pageLayoutEditingWidgetIdComponentState } from '@/page-layout/states/pageLayoutEditingWidgetIdComponentState';
import { addWidgetToTab } from '@/page-layout/utils/addWidgetToTab';
import { createDefaultFieldsFromRelationWidget } from '@/page-layout/widgets/fields-from-relation/utils/createDefaultFieldsFromRelationWidget';
import { useNavigatePageLayoutSidePanel } from '@/side-panel/pages/page-layout/hooks/useNavigatePageLayoutSidePanel';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { SidePanelPages } from 'twenty-shared/types';
import { v4 as uuidv4 } from 'uuid';

type UseCreateFieldsFromRelationWidgetFromPickerParams = {
  pageLayoutId: string;
  tabId: string;
  objectMetadataId: string;
  getExistingWidgetPositionIndex: () => number | undefined;
  removeExistingWidgetIfReplacing: () => void;
};

export const useCreateFieldsFromRelationWidgetFromPicker = ({
  pageLayoutId,
  tabId,
  objectMetadataId,
  getExistingWidgetPositionIndex,
  removeExistingWidgetIfReplacing,
}: UseCreateFieldsFromRelationWidgetFromPickerParams) => {
  const store = useStore();
  const pageLayoutDraftState = useAtomComponentStateCallbackState(
    pageLayoutDraftComponentState,
    pageLayoutId,
  );
  const setPageLayoutEditingWidgetId = useSetAtomComponentState(
    pageLayoutEditingWidgetIdComponentState,
    pageLayoutId,
  );
  const { insertCreatedWidgetAtContext } =
    useInsertCreatedWidgetAtContext(pageLayoutId);
  const { navigatePageLayoutSidePanel } = useNavigatePageLayoutSidePanel();
  const handleCreateFieldsFromRelationWidget = useCallback(() => {
    const replacePositionIndex = getExistingWidgetPositionIndex();

    removeExistingWidgetIfReplacing();

    const updatedPageLayout = store.get(pageLayoutDraftState);
    const activeTab = updatedPageLayout.tabs.find((tab) => tab.id === tabId);
    const positionIndex =
      replacePositionIndex ?? activeTab?.widgets.length ?? 0;
    const widgetId = uuidv4();

    const newWidget = createDefaultFieldsFromRelationWidget({
      id: widgetId,
      pageLayoutTabId: tabId,
      objectMetadataId,
      positionIndex,
    });

    store.set(pageLayoutDraftState, (prev) => ({
      ...prev,
      tabs: addWidgetToTab(prev.tabs, tabId, newWidget),
    }));

    setPageLayoutEditingWidgetId(widgetId);
    insertCreatedWidgetAtContext({ newWidgetId: widgetId });

    navigatePageLayoutSidePanel({
      sidePanelPage: SidePanelPages.FieldsFromRelationSettings,
      focusTitleInput: true,
      resetNavigationStack: true,
    });
  }, [
    getExistingWidgetPositionIndex,
    insertCreatedWidgetAtContext,
    navigatePageLayoutSidePanel,
    objectMetadataId,
    pageLayoutDraftState,
    removeExistingWidgetIfReplacing,
    setPageLayoutEditingWidgetId,
    store,
    tabId,
  ]);

  return { handleCreateFieldsFromRelationWidget };
};
