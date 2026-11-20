import { SettingsAiPromptSectionList } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptSectionList';
import { styled } from '@linaria/react';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useQuery } from '@apollo/client/react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components/layout';
import { themeCssVariables } from 'twenty-ui/theme';
import { GetAiSystemPromptPreviewDocument } from '~/generated-metadata/graphql';
import { formatNumber } from '@/localization/utils/formatNumber';
import { useLingui } from '@lingui/react/macro';

const StyledSectionHeader = styled(Section.Header)`
  margin-block-end: 0;
`;

const StyledTitleContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

export const SettingsAiPrompts = () => {
  const { t } = useLingui();
  const { data: previewData } = useQuery(GetAiSystemPromptPreviewDocument);

  const preview = previewData?.getAiSystemPromptPreview;
  const sections = preview?.sections ?? [];

  const promptSections = sections.filter(
    (section) => section.title !== 'Workspace Instructions',
  );

  const totalTokenCount = isDefined(preview)
    ? t`~ ${formatNumber(preview.estimatedTokenCount, {
        abbreviate: true,
        decimals: 1,
      })} tokens`
    : '';

  return (
    <SettingsPageLayout
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.General),
        },
        { children: t`AI`, href: getSettingsPath(SettingsPath.AI) },
        { children: t`System Prompt` },
      ]}
    >
      <SettingsPageContainer>
        <Section.Root>
          <StyledTitleContainer>
            <StyledSectionHeader
              title={t`System Prompt`}
              description={totalTokenCount}
              level={3}
              size="lg"
              descriptionLineClamp={2}
            />
          </StyledTitleContainer>
        </Section.Root>
        <SettingsAiPromptSectionList sections={promptSections} />
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
