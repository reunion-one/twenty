import { type I18n } from '@lingui/core';
import { Container } from 'react-email';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <ShadowText>
        <>
          <Link
            href="https://web3p.in/"
            value={i18n._('Web3 CRM')}
            aria-label={i18n._("Visit Web3 CRM's website")}
          />
          <br />
          {'Mumbai, India 400064'}
        </>
      </ShadowText>
    </Container>
  );
};
