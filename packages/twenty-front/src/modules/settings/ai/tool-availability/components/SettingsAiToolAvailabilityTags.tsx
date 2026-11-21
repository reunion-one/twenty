import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Tag } from 'twenty-ui/primitives/data-display';
import { themeCssVariables } from 'twenty-ui/theme';

import { useAiToolAvailabilities } from '@/settings/ai/tool-availability/hooks/useAiToolAvailabilities';

type SettingsAiToolAvailabilityTagsProps = { toolIdentifier: string };

const StyledTags = styled.span`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

export const SettingsAiToolAvailabilityTags = ({
  toolIdentifier,
}: SettingsAiToolAvailabilityTagsProps) => {
  const { t } = useLingui();
  const { availabilityByToolIdentifier } = useAiToolAvailabilities();
  const availability = availabilityByToolIdentifier.get(toolIdentifier);

  if (
    availability?.isAgentEnabled !== false &&
    availability?.isMcpEnabled !== false
  ) {
    return null;
  }

  return (
    <StyledTags>
      {availability?.isAgentEnabled === false && (
        <Tag color="gray">{t`Agents off`}</Tag>
      )}
      {availability?.isMcpEnabled === false && (
        <Tag color="gray">{t`MCP off`}</Tag>
      )}
    </StyledTags>
  );
};
