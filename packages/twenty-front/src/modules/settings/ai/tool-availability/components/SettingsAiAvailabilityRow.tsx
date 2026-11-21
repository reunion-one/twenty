import { AppChip } from '@/applications/components/AppChip';
import { SettingsAiAvailabilityRowDetails } from '@/settings/ai/tool-availability/components/SettingsAiAvailabilityRowDetails';
import { AnimatedRotate } from '@/settings/roles/role-permissions/object-level-permissions/object-form/components/internal/AnimatedRotate/AnimatedRotate';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { memo } from 'react';
import { IconChevronDown, IconChevronRight } from 'twenty-ui/icon';
import { Checkbox } from 'twenty-ui/primitives/input';
import { Tooltip } from 'twenty-ui/primitives/surfaces';
import { OverflowingTextWithTooltip } from 'twenty-ui/primitives/typography';
import { themeCssVariables } from 'twenty-ui/theme';
import { type SetAiToolAvailabilityInput } from '~/generated-metadata/graphql';
import { SettingsToolIcon } from '~/pages/settings/ai/components/SettingsToolIcon';
import { type SettingsAgentToolApplication } from '~/pages/settings/ai/types/SettingsAgentToolApplication';
import { type SettingsAgentToolItem } from '~/pages/settings/ai/types/SettingsAgentToolItem';
import { type SettingsAgentToolMarketplaceApp } from '~/pages/settings/ai/types/SettingsAgentToolMarketplaceApp';

export const AVAILABILITY_TABLE_GRID_TEMPLATE_COLUMNS =
  'minmax(0, 1fr) minmax(0, 140px) 60px 60px';

const StyledNameButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
  padding: 0;
  text-align: left;
  width: 100%;

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
  }
`;

const StyledDetails = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]}
    ${themeCssVariables.spacing[4]};
`;

type SettingsAiAvailabilityRowProps = {
  tool: SettingsAgentToolItem;
  application?: SettingsAgentToolApplication;
  marketplaceApp?: SettingsAgentToolMarketplaceApp;
  applicationId: string;
  availability: Omit<SetAiToolAvailabilityInput, 'toolIdentifier'>;
  isAgentLocked: boolean;
  isMcpLocked: boolean;
  isDisabled: boolean;
  isOpen: boolean;
  iconSize: number;
  iconStroke: number;
  onToggle: (toolIdentifier: string) => void;
  onChange: (
    toolIdentifier: string,
    availability: Omit<SetAiToolAvailabilityInput, 'toolIdentifier'>,
  ) => void;
};

export const SettingsAiAvailabilityRow = memo(
  ({
    tool,
    application,
    marketplaceApp,
    applicationId,
    availability,
    isAgentLocked,
    isMcpLocked,
    isDisabled,
    isOpen,
    iconSize,
    iconStroke,
    onToggle,
    onChange,
  }: SettingsAiAvailabilityRowProps) => {
    const { t } = useLingui();
    const label = tool.label ?? tool.name;
    const agentsAriaLabel = t`Agents for ${label}`;
    const mcpAriaLabel = t`MCP for ${label}`;

    return (
      <>
        <TableRow
          gridTemplateColumns={AVAILABILITY_TABLE_GRID_TEMPLATE_COLUMNS}
          isExpanded={isOpen}
        >
          <TableCell minWidth="0">
            <StyledNameButton
              type="button"
              onClick={() => onToggle(tool.identifier)}
              aria-expanded={isOpen}
            >
              <AnimatedRotate key={String(isOpen)}>
                {isOpen ? (
                  <IconChevronDown size={iconSize} stroke={iconStroke} />
                ) : (
                  <IconChevronRight size={iconSize} stroke={iconStroke} />
                )}
              </AnimatedRotate>
              <SettingsToolIcon
                icon={tool.icon}
                toolName={tool.name}
                objectName={tool.objectName ?? undefined}
                application={application}
                marketplaceApp={marketplaceApp}
              />
              <OverflowingTextWithTooltip text={label} />
            </StyledNameButton>
          </TableCell>
          <TableCell minWidth="0">
            <AppChip applicationId={applicationId} />
          </TableCell>
          {(['isAgentEnabled', 'isMcpEnabled'] as const).map((field) => {
            const isLocked =
              field === 'isAgentEnabled' ? isAgentLocked : isMcpLocked;
            const checkbox = (
              <Checkbox
                aria-label={
                  field === 'isAgentEnabled' ? agentsAriaLabel : mcpAriaLabel
                }
                checked={!isLocked && availability[field]}
                disabled={isDisabled || isLocked}
                onCheckedChange={(checked) =>
                  onChange(tool.identifier, {
                    ...availability,
                    [field]: checked,
                  })
                }
              />
            );

            return (
              <TableCell key={field}>
                {isLocked ? (
                  <Tooltip
                    content={
                      field === 'isAgentEnabled'
                        ? t`Never available to agents`
                        : t`Never available over MCP`
                    }
                  >
                    <span>{checkbox}</span>
                  </Tooltip>
                ) : (
                  checkbox
                )}
              </TableCell>
            );
          })}
        </TableRow>
        {isOpen && (
          <StyledDetails>
            <SettingsAiAvailabilityRowDetails tool={tool} />
          </StyledDetails>
        )}
      </>
    );
  },
);
