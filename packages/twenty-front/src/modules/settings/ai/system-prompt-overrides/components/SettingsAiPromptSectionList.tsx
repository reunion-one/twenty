import { SettingsAiPromptSection } from '@/settings/ai/system-prompt-overrides/components/SettingsAiPromptSection';
import { useAiSystemPromptOverrides } from '@/settings/ai/system-prompt-overrides/hooks/useAiSystemPromptOverrides';
import { type GetAiSystemPromptPreviewQuery } from '~/generated-metadata/graphql';

type SettingsAiPromptSectionListProps = {
  sections: GetAiSystemPromptPreviewQuery['getAiSystemPromptPreview']['sections'];
};

export const SettingsAiPromptSectionList = ({
  sections,
}: SettingsAiPromptSectionListProps) => {
  const { sections: overrideSections } = useAiSystemPromptOverrides();
  const overrideSectionByTitle = new Map(
    overrideSections.map((section) => [section.title, section]),
  );

  return sections.map((section) => {
    const overrideSection = overrideSectionByTitle.get(section.title);

    return (
      <SettingsAiPromptSection
        key={section.title}
        section={section}
        overrideSection={overrideSection}
      />
    );
  });
};
