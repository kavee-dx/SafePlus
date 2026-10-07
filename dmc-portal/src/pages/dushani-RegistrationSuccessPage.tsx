import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { Colors } from "../constants/theme";

interface RegistrationSuccessPageProps {
  onBack: () => void;
  registrationType: string;
}

const NEXT_STEPS = [
  {
    title: "Super Admin review",
    body: "Your registration details and supporting information are checked against DMC records.",
  },
  {
    title: "Approval notification",
    body: "You receive an email as soon as the review is complete, approved or declined.",
  },
  {
    title: "Account activation",
    body: "Once approved you can sign in to the SafePlus portal and open your dashboard.",
  },
];

function getRegistrationTitle(registrationType: string): string {
  switch (registrationType) {
    case "dmc-officer":
      return "DMC Officer";
    case "district-officer":
      return "District Disaster Management Officer";
    case "relief-agency":
      return "Relief Agency";
    case "organization-admin":
      return "Organization Admin";
    case "food-donor":
      return "Food Donor";
    case "delivery-volunteer":
      return "Delivery Volunteer";
    case "delivery-volunteer-team":
      return "Delivery Volunteer Team";
    case "coordinator":
      return "Relief Operations Coordinator";
    default:
      return "Account";
  }
}

export default function RegistrationSuccessPage({
  onBack,
  registrationType,
}: RegistrationSuccessPageProps) {
  return (
    <div className="registration-success-page">
      <header className="success-hero">
        <div className="success-hero-inner">
          <div className="hero-top">
            <button className="back-button" onClick={onBack}>
              <ArrowLeft size={18} />
              Back to Login
            </button>

            <div className="brand">
              <div className="brand-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="brand-name">
                  Safe<span>Plus</span>
                </div>
                <div className="brand-subtitle">REGISTRATION SUBMITTED</div>
              </div>
            </div>
          </div>

          <div className="hero-heading">
            <h1>Registration submitted</h1>
            <p>
              Your {getRegistrationTitle(registrationType)} registration is now
              with the Super Admin for verification.
            </p>
          </div>
        </div>
      </header>

      <main className="success-main">
        <div className="success-hero-card">
          <div className="success-icon-wrapper">
            <CheckCircle2 size={44} />
          </div>
          <h2>Thank you for registering</h2>
          <p>
            Keep an eye on your inbox — the review usually completes within two
            working days.
          </p>
          <span className="status-pill">
            <Clock size={13} />
            Pending verification
          </span>
        </div>

        <div className="steps-card">
          <h3>What happens next</h3>
          <ol>
            {NEXT_STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="step-number">{index + 1}</span>
                <div className="step-content">
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button className="action-button" onClick={onBack}>
          Return to login
          <ArrowLeft size={17} style={{ transform: "rotate(180deg)" }} />
        </button>

        <div className="support-notice">
          <Mail size={17} />
          <p>
            Need help? Contact our support team at{" "}
            <a href="mailto:support@safeplus.gov.lk">support@safeplus.gov.lk</a>
          </p>
        </div>
      </main>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .registration-success-page {
            min-height: 100vh;
            min-height: 100dvh;
            width: 100%;
            display: flex;
            flex-direction: column;
            background: ${Colors.background};
            font-family:
              Inter,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          /* =========================
             NAVY HERO BAND
          ========================= */

          .success-hero {
            background: ${Colors.navy};
            padding: clamp(24px, 3vw, 36px) clamp(20px, 4vw, 48px) 112px;
          }

          .success-hero-inner {
            max-width: 720px;
            margin: 0 auto;
          }

          .hero-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
          }

          .back-button {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 11px 18px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.08);
            color: ${Colors.white};
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 160ms ease;
          }

          .back-button:hover {
            background: ${Colors.navyLight};
            border-color: rgba(255, 255, 255, 0.34);
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .brand-icon {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: ${Colors.success};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .brand-name {
            font-size: 19px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: ${Colors.white};
          }

          .brand-name span {
            color: ${Colors.amber};
          }

          .brand-subtitle {
            color: ${Colors.blueLight};
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.09em;
            margin-top: 2px;
          }

          .hero-heading {
            margin-top: clamp(28px, 4vw, 40px);
          }

          .hero-heading h1 {
            font-size: clamp(26px, 3.6vw, 34px);
            font-weight: 800;
            letter-spacing: -0.03em;
            color: ${Colors.white};
            margin: 0 0 10px;
          }

          .hero-heading p {
            color: ${Colors.blueLight};
            font-size: 14px;
            line-height: 1.65;
            margin: 0;
            max-width: 540px;
          }

          /* =========================
             CONTENT CARDS
          ========================= */

          .success-main {
            flex: 1;
            width: 100%;
            max-width: 720px;
            margin: -80px auto 0;
            padding: 0 clamp(20px, 4vw, 48px) clamp(40px, 6vw, 72px);
          }

          .success-hero-card {
            padding: clamp(28px, 4vw, 40px);
            border-radius: 20px;
            background: ${Colors.white};
            border: 1px solid ${Colors.border};
            box-shadow: 0 10px 30px rgba(11, 31, 51, 0.07);
            text-align: center;
          }

          .success-icon-wrapper {
            width: 84px;
            height: 84px;
            margin: 0 auto 20px;
            border-radius: 26px;
            background: rgba(18, 183, 106, 0.12);
            color: ${Colors.success};
            display: flex;
            align-items: center;
            justify-content: center;
            animation: scaleIn 0.45s ease-out;
          }

          @keyframes scaleIn {
            from {
              transform: scale(0.7);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          .success-hero-card h2 {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: ${Colors.navy};
            margin: 0 0 10px;
          }

          .success-hero-card p {
            font-size: 14px;
            color: ${Colors.muted};
            line-height: 1.65;
            margin: 0 auto 22px;
            max-width: 420px;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 8px 14px;
            border-radius: 999px;
            background: ${Colors.amberLight};
            color: ${Colors.amberText};
            font-size: 12px;
            font-weight: 800;
          }

          .steps-card {
            margin-top: 20px;
            padding: clamp(24px, 3vw, 30px);
            border-radius: 20px;
            background: ${Colors.white};
            border: 1px solid ${Colors.border};
            box-shadow: 0 10px 30px rgba(11, 31, 51, 0.07);
          }

          .steps-card h3 {
            font-size: 17px;
            font-weight: 800;
            color: ${Colors.navy};
            letter-spacing: -0.02em;
            margin: 0 0 20px;
          }

          .steps-card ol {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .steps-card li {
            display: flex;
            gap: 16px;
            padding: 16px 0;
            border-bottom: 1px solid ${Colors.background};
          }

          .steps-card li:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .step-number {
            flex-shrink: 0;
            width: 32px;
            height: 32px;
            border-radius: 11px;
            background: ${Colors.navy};
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
          }

          .step-content {
            flex: 1;
          }

          .step-content strong {
            display: block;
            font-size: 14.5px;
            font-weight: 800;
            color: ${Colors.navy};
            margin-bottom: 4px;
          }

          .step-content span {
            display: block;
            font-size: 13px;
            color: ${Colors.muted};
            line-height: 1.6;
          }

          .action-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            height: 54px;
            margin-top: 20px;
            border: none;
            border-radius: 14px;
            background: ${Colors.blue};
            color: ${Colors.white};
            font-family: inherit;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(21, 112, 239, 0.28);
            transition:
              transform 160ms ease,
              box-shadow 160ms ease,
              background 160ms ease;
          }

          .action-button:hover {
            background: ${Colors.blueDark};
            transform: translateY(-1px);
            box-shadow: 0 16px 34px rgba(21, 112, 239, 0.34);
          }

          .support-notice {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 20px;
            padding: 16px 18px;
            border-radius: 16px;
            background: ${Colors.blueLight};
            border: 1px solid ${Colors.blue};
          }

          .support-notice svg {
            flex-shrink: 0;
            color: ${Colors.blue};
          }

          .support-notice p {
            font-size: 12.5px;
            color: ${Colors.muted};
            line-height: 1.6;
            margin: 0;
          }

          .support-notice a {
            color: ${Colors.blueDark};
            text-decoration: none;
            font-weight: 700;
          }

          .support-notice a:hover {
            text-decoration: underline;
          }

          /* =========================
             RESPONSIVE
          ========================= */

          @media (max-width: 768px) {
            .success-hero {
              padding-bottom: 100px;
            }

            .success-main {
              margin-top: -68px;
            }

            .success-icon-wrapper {
              width: 72px;
              height: 72px;
            }

            .success-hero-card h2 {
              font-size: 21px;
            }

            .steps-card li {
              flex-direction: column;
              gap: 10px;
            }
          }

          @media (max-width: 480px) {
            .hero-top {
              flex-direction: column-reverse;
              align-items: flex-start;
              gap: 18px;
            }

            .back-button {
              width: 100%;
              justify-content: center;
            }

            .brand {
              width: 100%;
            }

            .hero-heading h1 {
              font-size: 24px;
            }

            .action-button {
              height: 55px;
            }
          }
        `}
      </style>
    </div>
  );
}
