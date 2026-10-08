import {
  MapPin,
  ArrowLeft,
  ShieldCheck,
  Truck,
  Info,
  Building2,
  LifeBuoy,
  Ambulance,
} from "lucide-react";

import { Colors } from "../constants/theme";

interface RegistrationSelectionPageProps {
  onBack: () => void;
  onSelectType: (type: string) => void;
}

const REGISTRATION_TYPES = [
  {
    id: "dmc-officer",
    eyebrow: "National level",
    title: "DMC Officer",
    description:
      "Disaster Management Centre officers coordinating emergencies at national level.",
    icon: ShieldCheck,
  },
  {
    id: "district-officer",
    eyebrow: "District level",
    title: "District Disaster Management Officer",
    description:
      "District-level officers coordinating disaster management within a district.",
    icon: MapPin,
  },
  {
    id: "coordinator",
    eyebrow: "Relief operations",
    title: "Relief Operations Coordinator",
    description:
      "Allocate relief resources, assign delivery volunteers and teams, and track deliveries.",
    icon: Truck,
  },
  {
    id: "organization-admin",
    eyebrow: "Rescue organization",
    title: "Organization Admin",
    description:
      "Run a rescue organization on the portal and approve or reject the teams registered under it.",
    icon: Building2,
  },
  {
    id: "rescue-organization",
    eyebrow: "Rescue organization",
    title: "Rescue Organization",
    description:
      "Register a government, armed forces, police, fire, NGO or private rescue service with its administering representative.",
    icon: LifeBuoy,
  },
  {
    id: "rescue-team",
    eyebrow: "Rescue team",
    title: "Rescue Team Leader",
    description:
      "Register the team you lead. Teams under a verified organization are approved by that organization's admin; independent and community teams are approved by a DMC Super Admin.",
    icon: Ambulance,
  },
];

export default function RegistrationSelectionPage({
  onBack,
  onSelectType,
}: RegistrationSelectionPageProps) {
  return (
    <div className="registration-selection-page">
      <header className="selection-hero">
        <div className="selection-hero-inner">
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
                <div className="brand-subtitle">OFFICIAL PORTAL</div>
              </div>
            </div>
          </div>

          <div className="hero-heading">
            <h1>Choose your registration type</h1>
            <p>
              Select the option that best describes your role in the disaster
              management system. Every account is verified before access is
              granted.
            </p>
          </div>
        </div>
      </header>

      <main className="selection-main">
        <div className="registration-grid">
          {REGISTRATION_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                className="registration-card"
                onClick={() => onSelectType(type.id)}
              >
                <div className="card-icon">
                  <Icon size={24} />
                </div>
                <div className="card-content">
                  <span className="card-eyebrow">{type.eyebrow}</span>
                  <h3>{type.title}</h3>
                  <p>{type.description}</p>
                </div>
                <div className="card-arrow">
                  <ArrowLeft size={18} style={{ transform: "rotate(180deg)" }} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="selection-notice">
          <Info size={18} />
          <div>
            <strong>Verified before access</strong>
            <span>
              A Super Admin reviews each portal submission. Rescue team leaders
              register their team here and, once verified, sign in on both this
              portal and the SafePlus mobile app for field operations.
            </span>
          </div>
        </div>
      </main>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .registration-selection-page {
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

          .selection-hero {
            background: ${Colors.navy};
            padding: clamp(24px, 3vw, 36px) clamp(20px, 4vw, 48px) 116px;
          }

          .selection-hero-inner {
            max-width: 1000px;
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
            background: ${Colors.blue};
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
            margin-top: clamp(28px, 4vw, 44px);
            max-width: 640px;
          }

          .hero-heading h1 {
            font-size: clamp(28px, 4vw, 40px);
            font-weight: 800;
            letter-spacing: -0.035em;
            color: ${Colors.white};
            margin: 0 0 12px;
          }

          .hero-heading p {
            color: ${Colors.blueLight};
            font-size: 15px;
            line-height: 1.65;
            margin: 0;
          }

          /* =========================
             CARDS
          ========================= */

          .selection-main {
            flex: 1;
            width: 100%;
            max-width: 1000px;
            margin: -84px auto 0;
            padding: 0 clamp(20px, 4vw, 48px) clamp(40px, 6vw, 72px);
          }

          .registration-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
          }

          .registration-card {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
            padding: 28px;
            border: 1px solid ${Colors.border};
            border-radius: 20px;
            background: ${Colors.white};
            cursor: pointer;
            transition:
              border-color 200ms ease,
              box-shadow 200ms ease,
              transform 200ms ease;
            position: relative;
            text-align: left;
            box-shadow: 0 10px 30px rgba(11, 31, 51, 0.07);
            font-family: inherit;
          }

          .registration-card:hover {
            border-color: ${Colors.blue};
            box-shadow: 0 18px 40px rgba(21, 112, 239, 0.16);
            transform: translateY(-3px);
          }

          .card-icon {
            width: 52px;
            height: 52px;
            border-radius: 15px;
            background: ${Colors.blueLight};
            color: ${Colors.blue};
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .card-content {
            flex: 1;
          }

          .card-eyebrow {
            display: block;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            color: ${Colors.muted};
            margin-bottom: 8px;
          }

          .card-content h3 {
            font-size: 19px;
            font-weight: 800;
            color: ${Colors.navy};
            margin: 0 0 8px;
            letter-spacing: -0.02em;
            line-height: 1.3;
          }

          .card-content p {
            font-size: 14px;
            color: ${Colors.muted};
            line-height: 1.6;
            margin: 0;
          }

          .card-arrow {
            position: absolute;
            top: 28px;
            right: 24px;
            color: ${Colors.blue};
            opacity: 0;
            transition: opacity 200ms ease;
          }

          .registration-card:hover .card-arrow {
            opacity: 1;
          }

          .selection-notice {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            margin-top: 24px;
            padding: 18px 20px;
            border-radius: 16px;
            background: ${Colors.blueLight};
            border: 1px solid ${Colors.blue};
          }

          .selection-notice svg {
            flex-shrink: 0;
            color: ${Colors.blue};
            margin-top: 2px;
          }

          .selection-notice strong {
            display: block;
            color: ${Colors.navy};
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 4px;
          }

          .selection-notice span {
            display: block;
            color: ${Colors.muted};
            font-size: 12px;
            line-height: 1.6;
          }

          /* =========================
             RESPONSIVE
          ========================= */

          @media (max-width: 768px) {
            .selection-hero {
              padding-bottom: 104px;
            }

            .selection-main {
              margin-top: -72px;
            }

            .registration-grid {
              grid-template-columns: 1fr;
            }

            .registration-card {
              padding: 24px;
            }

            .card-content h3 {
              font-size: 17px;
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
          }
        `}
      </style>
    </div>
  );
}
