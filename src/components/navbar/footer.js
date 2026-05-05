import React from "react";
import styled from "styled-components";

const FooterWrapper = styled.footer`
  // width: 100%;
  background-color: #000;
  color: #fff;
  margin-top: 30px;
  padding: 40px 30px;
  position: relative;
  z-index: 5;
`;

const FooterContent = styled.div`
  // max-width: 1440px;
  // width: 100%;
  // margin: 0 auto;
  padding: 0 40px;
  display: flex;
  // background-color: green;
  flex-direction: column;
`;

const MainFooterSection = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  justify-content: space-between;
  gap: 40px;
  // padding-bottom: 40px;
  height: 100%;
  padding: 20px 0px;
  // background-color: yellow;
  // min-height: 150px;

  @media (max-width: 768px) {
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    gap: 30px;
    flex-direction: column;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    font-size: 90px;
    margin: 0;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 100px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const FooterBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  // background-color: red;
  padding-top: 30px;
  // gap: 20px;

  @media (max-width: 768px) {
  }

  @media (max-width: 480px) {
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    flex-direction: column;
    align-items: flex-start;
    align-items: center;
    text-align: center;
    gap: 15px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    align-items: flex-start;
    margin: 0px;
    gap: 0px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 100px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const FooterColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 150px;
  justify-content: flex-start;

  align-items: flex-start;
  @media (max-width: 480px) {
    min-width: 100%;
    align-items: center;
    text-align: center;
  }
`;

const LogoSection = styled(FooterColumn)`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  // background-color: red;

  gap: 90px;

  @media (max-width: 768px) {
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    flex-direction: column;
    height: 100%;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 40px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 100px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

const FooterLogo = styled.img`
  height: 25px;
  width: auto;
`;

const QRCodeImage = styled.img`
  width: 70px;
  height: auto;
`;

const FooterTitle = styled.h3`
  color: #545454;
  font-size: 16px;
  font-weight: 400;
  margin-top: 0px;
  margin-bottom: 20px;

  @media (max-width: 480px) {
    margin-bottom: 15px;
  }
`;

const FooterLink = styled.a`
  color: #fff;
  font-size: 17px;
  text-decoration: none;
  margin-bottom: 12px;
  transition: color 0.2s ease;

  &:hover {
    color: #0694fb;
  }

  @media (max-width: 480px) {
    font-size: 14px;
  }
`;

const SubscribeForm = styled.form`
  display: flex;
  gap: 10px;
  margin-top: 10px;

  @media (max-width: 480px) {
    flex-direction: column;
    width: 100%;
  }
`;

const EmailInput = styled.input`
  padding: 12px 12px;
  font-size: 14px;
  border: none;
  border-radius: 8px;
  background-color: #333;
  color: #fff;
  min-width: 200px;
  box-sizing: border-box @media (max-width: 480px) {
    width: 100%;
    min-width: auto;
  }
`;

const SubscribeButton = styled.button`
  padding: 12px 20px;
  font-size: 14px;
  border: none;
  background-color: #0694fb;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #0578c9;
  }

  @media (max-width: 480px) {
    width: 100%;
    min-width: auto;
  }
`;

const LegalText = styled.p`
  color: #545454;
  font-size: 14px;
  margin: 0;
  // background-color: green;
`;

const ContactEmail = styled.span`
  color: #0694fb;
`;

const LegalLinks = styled.div`
  display: flex;
  gap: 20px;

  @media (max-width: 480px) {
  }

  /* Mobile devices (320px - 480px) */
  @media (min-width: 320px) and (max-width: 480px) {
    flex-direction: row;
    gap: 10px;
  }

  /* iPads, Tablets (481px - 768px) */
  @media (min-width: 481px) and (max-width: 768px) {
    gap: 10px;
    // background-color: red;
    margin-top: 2px;
  }

  /* Small screens, laptops (769px - 1024px) */
  @media (min-width: 769px) and (max-width: 1024px) {
  }

  /* Desktops, large screens (1025px - 1200px) */
  @media (min-width: 1025px) and (max-width: 1200px) {
    font-size: 100px;
  }

  /* Extra large screens, TV (1201px and more) */
  @media (min-width: 1201px) {
  }
`;

function Footer() {
  return (
    <FooterWrapper>
      <FooterContent>
        <MainFooterSection>
          <LogoSection>
            <FooterLogo src="intellidiag.png" alt="IntelliDiag Logo" />
            <QRCodeImage src="qrcode.png" alt="QR Code" />
          </LogoSection>

          <FooterColumn>
            <FooterTitle>Connect</FooterTitle>
            <FooterLink href="https://x.com/intelliDiag">X</FooterLink>
            <FooterLink href="/">LinkedIn</FooterLink>
            <FooterLink href="/">Facebook</FooterLink>
            <FooterLink href="/">YouTube</FooterLink>
          </FooterColumn>

          <FooterColumn>
            <FooterTitle>Information</FooterTitle>
            <FooterLink href="/">How it works</FooterLink>
            <FooterLink href="/">Help Center</FooterLink>
            <FooterLink href="/">Support</FooterLink>
            <FooterLink href="/">What's new</FooterLink>
          </FooterColumn>

          <FooterColumn>
            <FooterTitle>Company</FooterTitle>
            <FooterLink href="/">Blog</FooterLink>
            <FooterLink href="/">Careers</FooterLink>
          </FooterColumn>

          <FooterColumn>
            <FooterTitle>Subscribe to our updates</FooterTitle>
            <SubscribeForm>
              <EmailInput type="email" placeholder="Your email" />
              <SubscribeButton>Send</SubscribeButton>
            </SubscribeForm>
          </FooterColumn>
        </MainFooterSection>

        <FooterBottom>
          <div>
            <LegalText>© 2025 IntelliDiag. All rights reserved.</LegalText>
            <LegalLinks>
              <FooterLink
                style={{
                  fontSize: "14px",
                }}
                href="/"
              >
                Privacy Policy
              </FooterLink>
              <FooterLink
                style={{
                  fontSize: "14px",
                }}
                href="/"
              >
                Terms of Use
              </FooterLink>
            </LegalLinks>
          </div>

          <div>
            <LegalText>
              For jobs <ContactEmail>jobs@intelliDiag.com</ContactEmail>
            </LegalText>
            <LegalText>
              For partnerships{" "}
              <ContactEmail>partners@intelliDiag.com</ContactEmail>
            </LegalText>
          </div>
        </FooterBottom>
      </FooterContent>
    </FooterWrapper>
  );
}

export default Footer;
