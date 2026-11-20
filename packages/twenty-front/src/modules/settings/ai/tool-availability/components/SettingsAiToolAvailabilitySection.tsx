import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components/layout';
import { IconLego, IconSparkles } from 'twenty-ui/icon';
import { Card } from 'twenty-ui/primitives/surfaces';

import { AI_TOOL_NEVER_OFFERED_TOOL_NAMES } from '@/settings/ai/tool-availability/constants/AiToolNeverOfferedToolNames';
import { useAiToolAvailabilities } from '@/settings/ai/tool-availability/hooks/useAiToolAvailabilities';
import { SettingsOptionCardContentSwitch } from '@/settings/components/SettingsOptions/SettingsOptionCardContentSwitch';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { PermissionFlagType } from '~/generated-metadata/graphql';

type SettingsAiToolAvailabilitySectionProps = {
  toolIdentifier: string;
  toolName: string | null;
};

export const SettingsAiToolAvailabilitySection = ({
  toolIdentifier,
  toolName,
}: SettingsAiToolAvailabilitySectionProps) => {
  const { t } = useLingui();
  const canEdit = useHasPermissionFlag(PermissionFlagType.AI_SETTINGS);
  const { availabilityByToolIdentifier, isLoading, setAvailability } =
    useAiToolAvailabilities();
  const availability = availabilityByToolIdentifier.get(toolIdentifier);
  const isNeverAvailableToAgents =
    isDefined(toolName) &&
    AI_TOOL_NEVER_OFFERED_TOOL_NAMES.agents.has(toolName);
  const isNeverAvailableOverMcp =
    isDefined(toolName) && AI_TOOL_NEVER_OFFERED_TOOL_NAMES.mcp.has(toolName);
  const isAgentEnabled = availability?.isAgentEnabled ?? true;
  const isMcpEnabled = availability?.isMcpEnabled ?? true;

  return (
    <Section.Root>
      <Section.Header
        title={t`Availability`}
        description={t`Choose where this tool can be used`}
      />
      <Card.Root>
        <SettingsOptionCardContentSwitch
          Icon={IconLego}
          title={t`Agents`}
          description={
            isNeverAvailableToAgents
              ? t`Never available to agents`
              : t`The AI assistant, custom agents and workflow agent steps`
          }
          checked={!isNeverAvailableToAgents && isAgentEnabled}
          disabled={!canEdit || isLoading || isNeverAvailableToAgents}
          onChange={(checked) => {
            void setAvailability({
              toolIdentifier,
              toolName,
              isAgentEnabled: checked,
              isMcpEnabled,
            });
          }}
          divider
        />
        <SettingsOptionCardContentSwitch
          Icon={IconSparkles}
          title={t`MCP`}
          description={
            isNeverAvailableOverMcp
              ? t`Never available over MCP`
              : t`External clients connected to your workspace`
          }
          checked={!isNeverAvailableOverMcp && isMcpEnabled}
          disabled={!canEdit || isLoading || isNeverAvailableOverMcp}
          onChange={(checked) => {
            void setAvailability({
              toolIdentifier,
              toolName,
              isAgentEnabled,
              isMcpEnabled: checked,
            });
          }}
        />
      </Card.Root>
    </Section.Root>
  );
};
