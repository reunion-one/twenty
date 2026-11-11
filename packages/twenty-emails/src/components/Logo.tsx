import { DEFAULT_WORKSPACE_LOGO } from 'src/constants/DefaultWorkspaceLogo';
import { type I18n } from '@lingui/core';
import { Img, Text } from 'react-email';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  i18n: I18n;
  serverUrl?: string;
};

export const Logo = ({ i18n, serverUrl }: LogoProps) => {
  if (!serverUrl) {
    return <Text style={logoStyle}>{i18n._('Web3 CRM')}</Text>;
  }

  return (
    <Img
      src={`${serverUrl}${DEFAULT_WORKSPACE_LOGO}`}
      alt={i18n._('Web3 CRM')}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
