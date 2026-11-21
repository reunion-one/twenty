import { logicFunctionsSelector } from '@/logic-functions/states/logicFunctionsSelector';
import { SettingsToolParameterTable } from '@/settings/ai/components/SettingsToolParameterTable';
import { SkeletonLine } from '@/ui/feedback/skeleton/components/SkeletonLine';
import { NavigationButton } from '@/ui/input/components/NavigationButton';
import { TextArea } from '@/ui/input/components/TextArea';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { isValidUuid } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components/layout';
import { IconArrowUpRight } from 'twenty-ui/icon';
import { GetToolInputSchemaDocument } from '~/generated-metadata/graphql';
import { type SettingsAgentToolItem } from '~/pages/settings/ai/types/SettingsAgentToolItem';
import { getToolLink } from '~/pages/settings/ai/utils/getToolLink';

const StyledOpenToolButton = styled(NavigationButton)`
  align-self: flex-start;
`;

type SettingsAiAvailabilityRowDetailsProps = {
  tool: SettingsAgentToolItem;
};

export const SettingsAiAvailabilityRowDetails = ({
  tool,
}: SettingsAiAvailabilityRowDetailsProps) => {
  const { t } = useLingui();
  const logicFunctions = useAtomStateValue(logicFunctionsSelector);
  const isCustomTool = isValidUuid(tool.identifier);
  const logicFunction = logicFunctions.find(({ id }) => id === tool.identifier);
  const { data, loading } = useQuery(GetToolInputSchemaDocument, {
    variables: { toolName: tool.name },
    skip: isCustomTool,
    fetchPolicy: 'cache-first',
  });
  const inputSchema = isCustomTool
    ? logicFunction?.toolTriggerSettings?.inputSchema
    : data?.getToolInputSchema;

  return (
    <>
      <Section.Root>
        <Section.Header
          title={t`Parameters`}
          description={t`Input parameters accepted by this tool`}
        />
        {loading ? (
          <SkeletonLine height={32} />
        ) : (
          <SettingsToolParameterTable
            schemaProperties={inputSchema?.properties ?? {}}
            requiredFields={inputSchema?.required}
          />
        )}
      </Section.Root>
      <Section.Root>
        <Section.Header
          title={t`Description`}
          description={t`Define what this tool does`}
        />
        <TextArea
          textAreaId={`tool-description-${tool.identifier}`}
          minRows={3}
          maxRows={5}
          value={tool.description ?? ''}
          disabled
        />
      </Section.Root>
      <StyledOpenToolButton
        to={getToolLink(tool)}
        startIcon={<IconArrowUpRight />}
        size="sm"
        variant="outline"
      >
        {t`Open tool page`}
      </StyledOpenToolButton>
    </>
  );
};
