import { forwardRef, useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { type SlashCommandItem } from '@/advanced-text-editor/extensions/slash-command/SlashCommand';
import { type SlashCommandMenuProps } from '@/advanced-text-editor/extensions/slash-command/types/SlashCommandMenuProps';
import { ListItemButton } from 'twenty-ui/components/navigation';
import { Tooltip } from 'twenty-ui/primitives/surfaces';
import { TooltipDelay } from '@/ui/layout/tooltip/constants/TooltipDelay';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { AI_SYSTEM_PROMPT_VARIABLES } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptVariables';
import { SuggestionMenu } from '@/ui/suggestion/components/SuggestionMenu';
import { type SuggestionMenuItemRenderProps } from '@/ui/suggestion/types/SuggestionMenuItemRenderProps';

const StyledDescription = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// Rows carry a description, so the upstream 176px list cap shows only three; raise it for this menu only.
const StyledMenuHeight = styled.div`
  display: contents;

  & [role='listbox'] > div > div {
    max-height: 320px;
  }
`;

const getItemKey = (item: SlashCommandItem) => item.id;

export const SettingsAiPromptVariableSuggestionMenu = forwardRef<
  unknown,
  SlashCommandMenuProps
>((props, ref) => {
  const { items, onSelect, editor, range } = props;
  const { t } = useLingui();
  const [tooltipHandle] = useState(() =>
    Tooltip.createHandle<SlashCommandItem>(),
  );

  const getItemSection = (item: SlashCommandItem) => {
    const group = AI_SYSTEM_PROMPT_VARIABLES.find(
      (variable) => variable.name === item.id,
    )?.group;

    return { key: group?.id ?? '', label: isDefined(group) ? t(group) : '' };
  };

  const renderItem = useCallback(
    ({
      item,
      isSelected,
      id,
    }: SuggestionMenuItemRenderProps<SlashCommandItem>) => {
      const Icon = item.icon;

      return (
        <Tooltip.Trigger
          handle={tooltipHandle}
          delay={TooltipDelay.longDelay}
          payload={item}
          render={
            <ListItemButton
              id={id}
              role="option"
              aria-selected={isSelected}
              selected={isSelected}
              tabIndex={-1}
              startIcon={isDefined(Icon) ? <Icon /> : undefined}
              description={
                <StyledDescription>{item.description}</StyledDescription>
              }
              descriptionPlacement="below"
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(item);
              }}
            >
              {item.title}
            </ListItemButton>
          }
        />
      );
    },
    [onSelect, tooltipHandle],
  );

  return (
    <Tooltip.Root handle={tooltipHandle}>
      {({ payload }) => (
        <>
          <StyledMenuHeight>
            <SuggestionMenu
              ref={ref}
              items={items}
              onSelect={onSelect}
              editor={editor}
              range={range}
              getItemKey={getItemKey}
              renderItem={renderItem}
              getItemSection={getItemSection}
            />
          </StyledMenuHeight>
          <Tooltip.Portal>
            <Tooltip.Positioner
              side="bottom"
              positionMethod="fixed"
              sideOffset={10}
            >
              <Tooltip.Popup>
                <Tooltip.Body description={payload?.description}>
                  {payload?.title}
                </Tooltip.Body>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </>
      )}
    </Tooltip.Root>
  );
});
