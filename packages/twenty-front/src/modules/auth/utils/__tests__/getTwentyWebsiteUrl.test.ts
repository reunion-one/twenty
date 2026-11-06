import { getTwentyWebsiteUrl } from '@/auth/utils/getTwentyWebsiteUrl';

describe('getTwentyWebsiteUrl', () => {
  it.each(['en', 'fr-FR', 'pseudo-en'])(
    'uses private deployment legal placeholders for %s',
    (locale) => {
      expect(getTwentyWebsiteUrl(locale, 'terms')).toBe('#');
      expect(getTwentyWebsiteUrl(locale, 'privacy-policy')).toBe('#');
    },
  );
});
