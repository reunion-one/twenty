import { isHiddenSystemField } from '@/object-metadata/utils/isHiddenSystemField';

describe('isHiddenSystemField @custom', () => {
  it('hides the system field rawProviderData', () => {
    expect(
      isHiddenSystemField({ name: 'rawProviderData', isSystem: true }),
    ).toBe(true);
  });

  it('keeps a user-defined field visible', () => {
    expect(
      isHiddenSystemField({ name: 'rawProviderData', isSystem: false }),
    ).toBe(false);
  });
});
