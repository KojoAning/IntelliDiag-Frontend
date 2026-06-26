import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const SECTIONS = [
  { id: "personal-info", title: "1. What Personal Information we collect" },
  { id: "how-we-use", title: "2. What we do with the Personal Information we collect" },
  { id: "when-we-disclose", title: "3. When we Disclose Personal Information" },
  { id: "cookies", title: "4. How we use cookies and collect information automatically" },
  { id: "security", title: "5. Security" },
  { id: "transfer", title: "6. How we Transfer Personal Information Internationally" },
  { id: "other-countries", title: "7. Other Countries" },
  { id: "links", title: "8. Links to other websites" },
  { id: "your-choices", title: "9. Your Choices" },
  { id: "accessing", title: "10. Accessing and Correcting your Personal Information" },
  { id: "data-retention", title: "11. Data Retention" },
  { id: "contact", title: "12. Contact Us" },
];

/* ── Styled Components ─────────────────────────────────────────────────── */

const Wrapper = styled.div`
  background: #000;
  min-height: 100vh;
  color: #fff;
  font-family: "Figtree", "SF Pro Display", sans-serif;
`;

const TopBar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 60px;
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  @media (max-width: 768px) {
    padding: 16px 24px;
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 32px;

  @media (max-width: 640px) {
    gap: 16px;
  }
`;

const NavLink = styled.button`
  background: transparent;
  border: none;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.2s;

  &:hover {
    color: #fff;
  }
`;

const HeroBanner = styled.div`
  background: #0694fb;
  padding: 80px 60px 60px;
  text-align: center;

  @media (max-width: 768px) {
    padding: 60px 24px 48px;
  }
`;

const HeroTitle = styled.h1`
  font-size: 64px;
  font-weight: 700;
  margin: 0 0 16px;
  letter-spacing: -1.5px;

  @media (max-width: 768px) {
    font-size: 42px;
  }
`;

const HeroDate = styled.p`
  font-size: 14px;
  margin: 0;
  opacity: 0.8;
`;

const ContentArea = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 60px 60px 100px;
  display: flex;
  gap: 80px;
  align-items: flex-start;

  @media (max-width: 960px) {
    flex-direction: column-reverse;
    gap: 40px;
    padding: 40px 24px 80px;
  }
`;

const MainContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const Sidebar = styled.aside`
  width: 280px;
  flex-shrink: 0;
  position: sticky;
  top: 100px;

  @media (max-width: 960px) {
    position: static;
    width: 100%;
  }
`;

const TOCTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px;
  color: #fff;
`;

const TOCList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TOCItem = styled.li`
  font-size: 13px;
  color: #888;
  cursor: pointer;
  transition: color 0.2s;
  line-height: 1.5;

  &:hover {
    color: #0694fb;
  }

  a {
    color: inherit;
    text-decoration: none;
  }
`;

const SectionTitle = styled.h2`
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  margin: 48px 0 16px;
  scroll-margin-top: 100px;

  &:first-of-type {
    margin-top: 0;
  }
`;

const SubTitle = styled.h3`
  font-size: 17px;
  font-weight: 600;
  color: #e0e0e0;
  margin: 28px 0 12px;
`;

const P = styled.p`
  font-size: 15px;
  line-height: 1.8;
  color: #999;
  margin: 0 0 16px;
`;

const UL = styled.ul`
  padding-left: 20px;
  margin: 0 0 16px;

  li {
    font-size: 15px;
    line-height: 1.8;
    color: #999;
    margin-bottom: 6px;
  }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin: 48px 0;
`;

const BackToTop = styled.button`
  display: block;
  margin: 60px auto 0;
  background: transparent;
  border: 1px solid #333;
  color: #888;
  font-size: 13px;
  padding: 10px 28px;
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;

  &:hover {
    color: #fff;
    border-color: #0694fb;
  }
`;

/* ── Component ──────────────────────────────────────────────────────────── */

function PrivacyPolicy() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Wrapper>
      {/* ── Top Nav ── */}
      <TopBar>
        <img
          src="/intellidiag.png"
          alt="IntelliDiag Logo"
          style={{ height: 20, cursor: "pointer" }}
          onClick={() => navigate("/")}
        />
        <NavLinks>
          <NavLink onClick={() => navigate("/")}>Home</NavLink>
          <NavLink onClick={() => navigate("/")}>About</NavLink>
          <NavLink onClick={() => navigate("/")}>Features</NavLink>
          <NavLink onClick={() => navigate("/")}>Contact</NavLink>
        </NavLinks>
      </TopBar>

      {/* ── Hero ── */}
      <HeroBanner>
        <HeroTitle>Privacy Policy</HeroTitle>
        <HeroDate>Last Updated June 26th, 2025</HeroDate>
      </HeroBanner>

      {/* ── Body ── */}
      <ContentArea>
        {/* Main text */}
        <MainContent>
          <P>
            This Privacy Policy will help you better understand how we collect,
            use, and share your personal information. By using the IntelliDiag
            platform, website, and services, you consent to the practices
            described in this policy.
          </P>

          <Divider />

          {/* ── 1. What Personal Information we collect ── */}
          <SectionTitle id="personal-info">
            1. What Personal Information we collect
          </SectionTitle>
          <P>
            To register for our Services, you provide your name and email address.
            If you make a purchase or subscribe to a plan, we collect billing
            information such as your payment method details, billing address, and
            transaction history. You may also choose to provide your profile
            information such as your medical specialty, institution name, phone
            number, and profile picture.
          </P>

          <SubTitle>Information we collect automatically</SubTitle>
          <P>
            When you use our Services, we automatically collect certain information,
            including:
          </P>
          <UL>
            <li>Device information (browser type, operating system, device identifiers)</li>
            <li>Log data (IP address, access times, pages viewed, referring URL)</li>
            <li>Usage data (features used, interactions with the platform, session duration)</li>
            <li>Location data (general geographic location derived from your IP address)</li>
          </UL>

          <SubTitle>Medical imaging data</SubTitle>
          <P>
            IntelliDiag processes medical imaging data (such as DICOM files) that
            you upload to the platform. This data may contain Protected Health
            Information (PHI) embedded in DICOM metadata, including patient names,
            dates of birth, medical record numbers, and study descriptions. We
            process this data solely to provide our diagnostic analysis services
            and do not use it for any other purpose.
          </P>

          <SubTitle>Information from third parties</SubTitle>
          <P>
            We may receive information about you from third-party sources such as
            identity verification services, payment processors, and PACS/EHR
            integrations that you connect to your IntelliDiag account.
          </P>

          {/* ── 2. What we do with it ── */}
          <SectionTitle id="how-we-use">
            2. What we do with the Personal Information we collect
          </SectionTitle>
          <P>
            We use the information we collect to provide, maintain, and improve our
            Services, including:
          </P>
          <UL>
            <li>Processing and analyzing medical images using our AI models</li>
            <li>Generating diagnostic reports and annotations</li>
            <li>Managing your account and providing customer support</li>
            <li>Processing payments and managing subscriptions</li>
            <li>Sending service-related communications (updates, security alerts, support messages)</li>
            <li>Monitoring and analyzing usage patterns to improve our platform</li>
            <li>Detecting, preventing, and addressing technical issues and security threats</li>
            <li>Complying with legal obligations and enforcing our terms of service</li>
          </UL>
          <P>
            We may use de-identified and aggregated data for research purposes to
            improve the accuracy and performance of our AI models. This data cannot
            be used to identify any individual patient or user.
          </P>

          {/* ── 3. When we Disclose ── */}
          <SectionTitle id="when-we-disclose">
            3. When we Disclose Personal Information
          </SectionTitle>
          <P>
            We do not sell your personal information to third parties. We may share
            your information in the following circumstances:
          </P>
          <UL>
            <li>
              <strong style={{ color: "#ccc" }}>Service providers:</strong> We share
              information with third-party vendors who assist us in providing our
              Services (cloud hosting, payment processing, analytics, customer support).
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Collaborators:</strong> If you use our
              collaboration features, relevant case and study information will be shared
              with the healthcare professionals you invite.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Legal requirements:</strong> We may
              disclose information if required by law, regulation, legal process, or
              governmental request.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Business transfers:</strong> In
              connection with a merger, acquisition, or sale of assets, your information
              may be transferred as part of that transaction.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>With your consent:</strong> We may share
              information for any other purpose with your explicit consent.
            </li>
          </UL>

          {/* ── 4. Cookies ── */}
          <SectionTitle id="cookies">
            4. How we use cookies and collect information automatically
          </SectionTitle>
          <P>
            We use cookies and similar tracking technologies to collect and track
            information about your use of our Services. Cookies are small data files
            stored on your device that help us improve your experience.
          </P>
          <SubTitle>Types of cookies we use</SubTitle>
          <UL>
            <li>
              <strong style={{ color: "#ccc" }}>Essential cookies:</strong> Required for
              the platform to function properly (authentication, session management, security).
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Analytics cookies:</strong> Help us
              understand how users interact with the platform so we can improve functionality
              and performance.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Preference cookies:</strong> Remember your
              settings and preferences (theme, layout, viewer configurations).
            </li>
          </UL>
          <P>
            You can control cookies through your browser settings. However, disabling
            certain cookies may limit your ability to use some features of our Services.
            We do not use advertising or marketing cookies.
          </P>

          {/* ── 5. Security ── */}
          <SectionTitle id="security">5. Security</SectionTitle>
          <P>
            We take the security of your data seriously and implement
            industry-standard measures to protect your personal information,
            including:
          </P>
          <UL>
            <li>Encryption of data in transit (TLS/SSL) and at rest (AES-256)</li>
            <li>Regular security audits and vulnerability assessments</li>
            <li>Access controls and role-based permissions</li>
            <li>Secure cloud infrastructure with SOC 2 Type II certified providers</li>
            <li>Automated threat detection and monitoring</li>
            <li>Employee security training and background checks</li>
          </UL>
          <P>
            While we strive to protect your information, no method of electronic
            storage or transmission is 100% secure. We encourage you to use strong
            passwords, enable two-factor authentication, and promptly report any
            unauthorized access to your account.
          </P>

          {/* ── 6. International Transfer ── */}
          <SectionTitle id="transfer">
            6. How we Transfer Personal Information Internationally
          </SectionTitle>
          <P>
            Your information may be transferred to and processed in countries other
            than your country of residence. These countries may have data protection
            laws that are different from the laws of your country. We ensure that
            appropriate safeguards are in place to protect your information in
            accordance with this Privacy Policy, including:
          </P>
          <UL>
            <li>Standard Contractual Clauses approved by the European Commission</li>
            <li>Data Processing Agreements with all sub-processors</li>
            <li>Compliance with applicable data transfer frameworks</li>
          </UL>

          {/* ── 7. Other Countries ── */}
          <SectionTitle id="other-countries">7. Other Countries</SectionTitle>
          <P>
            If you are accessing our Services from the European Economic Area (EEA),
            United Kingdom, Switzerland, or other jurisdictions with data protection
            laws, you have certain rights regarding your personal data under the
            General Data Protection Regulation (GDPR) and equivalent local laws.
          </P>
          <P>
            If you are a resident of California, you have rights under the California
            Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA),
            including the right to know what personal information we collect, the right
            to delete your data, and the right to opt out of the sale of personal
            information. We do not sell personal information.
          </P>
          <P>
            For users in Ghana and across Africa, we comply with the Ghana Data
            Protection Act, 2012 (Act 843) and other applicable regional data
            protection regulations, including the African Union Convention on Cyber
            Security and Personal Data Protection.
          </P>

          {/* ── 8. Links ── */}
          <SectionTitle id="links">8. Links to other websites</SectionTitle>
          <P>
            Our Services may contain links to third-party websites, plugins, or
            applications. Clicking on those links or enabling those connections may
            allow third parties to collect or share data about you. We do not control
            these third-party websites and are not responsible for their privacy
            practices. We encourage you to read the privacy policy of every website
            you visit.
          </P>

          {/* ── 9. Your Choices ── */}
          <SectionTitle id="your-choices">9. Your Choices</SectionTitle>
          <P>You have the following choices regarding your personal information:</P>
          <UL>
            <li>
              <strong style={{ color: "#ccc" }}>Account information:</strong> You can
              update or correct your account information at any time through your profile
              settings.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Communications:</strong> You can opt out
              of non-essential email communications by clicking the "unsubscribe" link in
              our emails or updating your notification preferences.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Data deletion:</strong> You can request
              deletion of your account and associated data by contacting us. Note that we
              may retain certain information as required by law or for legitimate business
              purposes.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Data export:</strong> You can request a
              copy of your personal data in a structured, machine-readable format.
            </li>
            <li>
              <strong style={{ color: "#ccc" }}>Cookies:</strong> You can manage your cookie
              preferences through your browser settings.
            </li>
          </UL>

          {/* ── 10. Accessing and Correcting ── */}
          <SectionTitle id="accessing">
            10. Accessing and Correcting your Personal Information
          </SectionTitle>
          <P>
            You have the right to access the personal information we hold about you
            and to request that we correct, update, or delete it. To exercise these
            rights, please contact us using the information provided below. We will
            respond to your request within 30 days, or within the timeframe required
            by applicable law.
          </P>
          <P>
            We may ask you to verify your identity before processing your request.
            In some cases, we may not be able to fulfill your request if it would
            compromise the privacy of others, if the information is required for legal
            compliance, or if we have a legitimate interest in retaining the data.
          </P>

          {/* ── 11. Data Retention ── */}
          <SectionTitle id="data-retention">11. Data Retention</SectionTitle>
          <P>
            We retain your personal information for as long as your account is active
            or as needed to provide you with our Services. We may also retain and use
            your information as necessary to comply with legal obligations, resolve
            disputes, and enforce our agreements.
          </P>
          <P>
            Medical imaging data uploaded to the platform is retained for the duration
            of your subscription. Upon account deletion or subscription cancellation,
            imaging data will be permanently deleted within 90 days unless a longer
            retention period is required by applicable healthcare regulations.
          </P>
          <P>
            De-identified and aggregated data used for research and model improvement
            may be retained indefinitely, as it cannot be linked back to any individual.
          </P>

          {/* ── 12. Contact Us ── */}
          <SectionTitle id="contact">12. Contact Us</SectionTitle>
          <P>
            If you have questions, concerns, or requests regarding this Privacy Policy
            or our data practices, please contact us at:
          </P>
          <UL>
            <li><strong style={{ color: "#ccc" }}>Email:</strong> privacy@intellidiag.app</li>
            <li><strong style={{ color: "#ccc" }}>General inquiries:</strong> support@intellidiag.app</li>
            <li><strong style={{ color: "#ccc" }}>Website:</strong> intellidiag.app</li>
          </UL>
          <P>
            We may update this Privacy Policy from time to time. We will notify you of
            any material changes by posting the new Privacy Policy on this page and
            updating the "Last Updated" date. Your continued use of the Services after
            any changes to this Privacy Policy constitutes your acceptance of such
            changes.
          </P>

          <BackToTop onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Back to top
          </BackToTop>
        </MainContent>

        {/* Table of contents */}
        <Sidebar>
          <TOCTitle>Table of contents</TOCTitle>
          <TOCList>
            {SECTIONS.map((s) => (
              <TOCItem key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {s.title}
                </a>
              </TOCItem>
            ))}
          </TOCList>
        </Sidebar>
      </ContentArea>
    </Wrapper>
  );
}

export default PrivacyPolicy;
