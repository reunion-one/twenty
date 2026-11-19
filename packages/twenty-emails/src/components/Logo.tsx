import { type I18n } from '@lingui/core';
import { Img } from 'react-email';
import { DEFAULT_WORKSPACE_LOGO } from 'src/constants/DefaultWorkspaceLogo';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  i18n: I18n;
};

export const Logo = ({ i18n }: LogoProps) => {
  return (
    <Img
      src={DEFAULT_WORKSPACE_LOGO}
      alt={i18n._('Web3 CRM logo')}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
