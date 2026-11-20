import { useMemo, useState } from 'react';
import { Tooltip } from 'twenty-ui/primitives/surfaces';
import { TooltipDelay } from '@/ui/layout/tooltip/constants/TooltipDelay';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { LightIconButton } from 'twenty-ui/components/input';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconVariable, IconVariablePlus } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme';

import { AI_SYSTEM_PROMPT_VARIABLES } from '@/settings/ai/system-prompt-overrides/constants/AiSystemPromptVariables';
import { SelectOptionIcon } from '@/ui/input/components/SelectOptionIcon';
import { type VariablePickerComponent } from '@/ui/input/types/VariablePickerComponent';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownRoot } from '@/ui/layout/dropdown/components/DropdownRoot';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';

// Reserves room for this button and the absolutely positioned expand button so text never runs under them.
const StyledSettingsAiPromptVariablePickerContainer = styled.div`
  align-self: flex-start;
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[1]};
  width: ${themeCssVariables.spacing[16]};
`;

const StyledDescription = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const SettingsAiPromptVariablePicker: VariablePickerComponent = ({
  instanceId,
  disabled,
  onVariableSelect,
}) => {
  const { t } = useLingui();
  const [tooltipHandle] = useState(() =>
    Tooltip.createHandle<{ title: string; description: string }>(),
  );
  const variables = useMemo(
    () =>
      AI_SYSTEM_PROMPT_VARIABLES.map((variable) => ({
        ...variable,
        tooltipContent: {
          title: t(variable.label),
          description: t(variable.description),
        },
      })),
    [t],
  );
  const groups = [
    ...new Map(
      AI_SYSTEM_PROMPT_VARIABLES.map(({ group }) => [group.id, group]),
    ).values(),
  ];

  return (
    <DropdownRoot
      dropdownId={`ai-system-prompt-variable-picker-${instanceId}`}
      type="picker"
    >
      <StyledSettingsAiPromptVariablePickerContainer>
        <Dropdown.Trigger
          aria-label={t`Insert variable`}
          disabled={disabled}
          render={
            <LightIconButton
              aria-label={t`Insert variable`}
              size="sm"
              emphasis="subtle"
            >
              <IconVariablePlus />
            </LightIconButton>
          }
        />
      </StyledSettingsAiPromptVariablePickerContainer>
      <DropdownContent
        align="end"
        sideOffset={4}
        width={GenericDropdownContentWidth.Large}
      >
        <Tooltip.Root handle={tooltipHandle}>
          {({ payload }) => (
            <>
              <Dropdown.Section scrollable>
                {groups.map((group) => (
                  <Dropdown.Section key={group.id} label={t(group)}>
                    {variables
                      .filter((variable) => variable.group.id === group.id)
                      .map(({ name, label, description, tooltipContent }) => (
                        <Tooltip.Trigger
                          key={name}
                          handle={tooltipHandle}
                          delay={TooltipDelay.longDelay}
                          payload={tooltipContent}
                          render={
                            <Dropdown.OptionItem
                              startIcon={
                                <SelectOptionIcon Icon={IconVariable} />
                              }
                              onSelect={() => onVariableSelect(`{{${name}}}`)}
                              description={
                                <StyledDescription>
                                  {t(description)}
                                </StyledDescription>
                              }
                              descriptionPlacement="below"
                            >
                              {t(label)}
                            </Dropdown.OptionItem>
                          }
                        />
                      ))}
                  </Dropdown.Section>
                ))}
              </Dropdown.Section>
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
      </DropdownContent>
    </DropdownRoot>
  );
};
