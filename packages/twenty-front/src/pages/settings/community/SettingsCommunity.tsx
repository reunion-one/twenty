import { SettingsCard } from '@/settings/components/SettingsCard';
import { SettingsDiscoveryHeroCard } from '@/settings/components/SettingsDiscoveryHeroCard';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsLabContent } from '@/settings/lab/components/SettingsLabContent';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Section } from 'twenty-ui/components/layout';
import { IconLink, type IconComponent } from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { MOBILE_VIEWPORT, useTheme, themeCssVariables } from 'twenty-ui/theme';
import coverDark from '~/pages/settings/community/assets/cover-dark.png';
import coverLight from '~/pages/settings/community/assets/cover-light.png';

const SETTINGS_COMMUNITY_HERO_INSTANCE_ID_PREFIX = 'settings-community-hero';

const StyledCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr;
  }
`;

const StyledFeaturesContent = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
`;

type SettingsCommunityLink = {
  href: string;
  Icon: IconComponent;
  iconColor: string;
  cardTitle: string;
};

export const SettingsCommunity = () => {
  const theme = useTheme();

  const socialLinks: SettingsCommunityLink[] = [
    {
      href: 'https://web3p.in',
      Icon: IconLink,
      iconColor: themeCssVariables.font.color.primary,
      cardTitle: t`Visit Web3 CRM`,
    },
  ];

  return (
    <SettingsPageLayout
      title={t`Community`}
      links={[
        {
          children: t`Other`,
          href: getSettingsPath(SettingsPath.Community),
        },
        { children: t`Community` },
      ]}
    >
      <SettingsPageContainer>
        <Section.Root>
          <SettingsDiscoveryHeroCard
            lightSrc={coverLight}
            darkSrc={coverDark}
            instanceIdPrefix={SETTINGS_COMMUNITY_HERO_INSTANCE_ID_PREFIX}
            tabs={[]}
          />
        </Section.Root>

        <Section.Root>
          <Section.Header
            title={t`Web3 CRM`}
            description={t`Visit our website for more information.`}
          />
          <StyledCardsGrid>
            {socialLinks.map(({ href, Icon, iconColor, cardTitle }) => (
              <SettingsCard
                key={href}
                href={href}
                Icon={
                  <Icon
                    size={theme.icon.size.md}
                    stroke={theme.icon.stroke.sm}
                  />
                }
                iconColor={iconColor}
                title={cardTitle}
              />
            ))}
          </StyledCardsGrid>
        </Section.Root>

        <Section.Root>
          <Section.Header
            title={t`Features`}
            description={t`Try our upcoming features. Note they are still in beta. Please bear with us and report any issues you find.`}
          />
          <StyledFeaturesContent>
            <SettingsLabContent />
          </StyledFeaturesContent>
        </Section.Root>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
