import { useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Colors } from "../constants/theme";

interface DmcLoginScreenProps {
  onLogin: () => void;
}

export default function KaveeshaDmcLoginScreen({
  onLogin,
}: DmcLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your DMC email and password.");
      return;
    }

    onLogin();
  };

  return (
    <div className="dmc-login-page">
      {/* Desktop / Tablet operations panel */}
      <section className="dmc-operations-panel">
        <div className="dmc-panel-grid" />

        <div className="dmc-panel-circle dmc-panel-circle-large" />
        <div className="dmc-panel-circle dmc-panel-circle-small" />

        <div className="dmc-operations-content">
          {/* Brand */}
          <div className="dmc-brand">
            <div className="dmc-brand-icon">
              <ShieldCheck size={25} />
            </div>

            <div>
              <div className="dmc-brand-name">
                Safe<span>Plus</span>
              </div>

              <div className="dmc-brand-subtitle">
                DMC OPERATIONS
              </div>
            </div>
          </div>

          {/* Main message */}
          <div className="dmc-operations-main">
            <div className="dmc-emergency-badge">
              <TriangleAlert size={14} />
              EMERGENCY COORDINATION
            </div>

            <h1>
              One command center.
              <br />
              <span>Every response connected.</span>
            </h1>

            <p>
              Monitor disasters, coordinate rescue teams, manage emergency
              resources, and keep communities connected through one unified
              platform.
            </p>
          </div>

          {/* Feature cards */}
          <div className="dmc-feature-grid">
            <div className="dmc-feature-card">
              <Radio size={17} />
              <strong>Live Alerts</strong>
              <span>Real-time updates</span>
            </div>

            <div className="dmc-feature-card">
              <Activity size={17} />
              <strong>Response</strong>
              <span>Team coordination</span>
            </div>

            <div className="dmc-feature-card">
              <ShieldCheck size={17} />
              <strong>Secure</strong>
              <span>Role-based access</span>
            </div>
          </div>
        </div>

        <div className="dmc-operations-footer">
          SRI LANKA • DISASTER MANAGEMENT • SAFEPLUS
        </div>
      </section>

      {/* Login panel */}
      <section className="dmc-login-panel">
        <div className="dmc-login-container">
          {/* Mobile brand */}
          <div className="dmc-mobile-brand">
            <div className="dmc-mobile-brand-icon">
              <ShieldCheck size={22} />
            </div>

            <div>
              <strong>
                Safe<span>Plus</span>
              </strong>

              <small>DMC OPERATIONS</small>
            </div>
          </div>

          {/* Heading */}
          <div className="dmc-login-heading">
            <div className="dmc-login-label">
              DMC SECURE ACCESS
            </div>

            <h2>Welcome back</h2>

            <p>
              Sign in to access the SafePlus emergency coordination portal.
            </p>
          </div>

          {/* Form */}
          <form className="dmc-login-form" onSubmit={handleSubmit}>
            <div className="dmc-field">
              <label>DMC email address</label>

              <div className="dmc-input-wrapper">
                <Mail size={18} />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="officer@dmc.gov.lk"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="dmc-field">
              <div className="dmc-password-header">
                <label>Password</label>

                <button
                  type="button"
                  onClick={() =>
                    alert("Password recovery will be connected later.")
                  }
                >
                  Forgot password?
                </button>
              </div>

              <div className="dmc-input-wrapper">
                <LockKeyhole size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="dmc-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <label className="dmc-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Keep me signed in</span>
            </label>

            {error && (
              <div className="dmc-error">
                {error}
              </div>
            )}

            <button type="submit" className="dmc-submit-button">
              Sign in to DMC Portal
            </button>
          </form>

          {/* Security notice */}
          <div className="dmc-security-notice">
            <LockKeyhole size={17} />

            <div>
              <strong>Protected operations access</strong>

              <span>
                This portal is restricted to authorized Disaster Management
                Centre personnel.
              </span>
            </div>
          </div>

          <div className="dmc-login-footer">
            SafePlus Emergency Coordination System
          </div>
        </div>
      </section>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .dmc-login-page {
            min-height: 100vh;
            min-height: 100dvh;
            width: 100%;
            display: flex;
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
             OPERATIONS PANEL
          ========================= */

          .dmc-operations-panel {
            flex: 1;
            min-width: 0;
            min-height: 100vh;
            background: ${Colors.navy};
            color: ${Colors.white};
            padding: clamp(32px, 5vw, 72px);
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
          }

          .dmc-panel-grid {
            position: absolute;
            inset: 0;
            opacity: 0.055;
            background-image:
              linear-gradient(
                rgba(255, 255, 255, 0.5) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.5) 1px,
                transparent 1px
              );
            background-size: 46px 46px;
          }

          .dmc-panel-circle {
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
          }

          .dmc-panel-circle-large {
            width: 460px;
            height: 460px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            right: -230px;
            top: -120px;
          }

          .dmc-panel-circle-small {
            width: 330px;
            height: 330px;
            border: 1px solid rgba(217, 45, 32, 0.18);
            right: -150px;
            top: -55px;
          }

          .dmc-operations-content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            flex: 1;
          }

          .dmc-brand {
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .dmc-brand-icon {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: ${Colors.red};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 30px ${Colors.red}45;
          }

          .dmc-brand-name {
            font-size: 21px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          .dmc-brand-name span,
          .dmc-mobile-brand strong span {
            color: ${Colors.red};
          }

          .dmc-brand-subtitle {
            color: #98a2b3;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            margin-top: 2px;
          }

          .dmc-operations-main {
            max-width: 650px;
            margin-top: clamp(70px, 13vh, 150px);
          }

          .dmc-emergency-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 7px 11px;
            border-radius: 8px;
            background: rgba(217, 45, 32, 0.12);
            border: 1px solid rgba(217, 45, 32, 0.25);
            color: #fda29b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .dmc-operations-main h1 {
            font-size: clamp(38px, 5vw, 64px);
            line-height: 1.05;
            letter-spacing: -0.045em;
            margin: 22px 0 0;
            font-weight: 800;
          }

          .dmc-operations-main h1 span {
            color: #fda29b;
          }

          .dmc-operations-main p {
            max-width: 520px;
            color: #98a2b3;
            font-size: 15px;
            line-height: 1.7;
            margin: 24px 0 0;
          }

          .dmc-feature-grid {
            position: relative;
            z-index: 2;
            display: grid;
            grid-template-columns: repeat(3, minmax(130px, 190px));
            gap: 12px;
            margin-top: 42px;
          }

          .dmc-feature-card {
            padding: 15px;
            border-radius: 13px;
            background: rgba(255, 255, 255, 0.055);
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
          }

          .dmc-feature-card svg {
            color: #fda29b;
            margin-bottom: 10px;
          }

          .dmc-feature-card strong {
            font-size: 12px;
            font-weight: 800;
          }

          .dmc-feature-card span {
            margin-top: 4px;
            font-size: 10px;
            color: #667085;
          }

          .dmc-operations-footer {
            position: relative;
            z-index: 2;
            color: #667085;
            font-size: 10px;
            letter-spacing: 0.06em;
            margin-top: 35px;
          }

          /* =========================
             LOGIN PANEL
          ========================= */

          .dmc-login-panel {
            width: min(510px, 43%);
            min-height: 100vh;
            background: ${Colors.white};
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }

          .dmc-login-container {
            width: 100%;
            max-width: 390px;
          }

          .dmc-mobile-brand {
            display: none;
          }

          .dmc-login-label {
            color: ${Colors.red};
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.09em;
          }

          .dmc-login-heading h2 {
            color: ${Colors.text};
            font-size: clamp(30px, 3vw, 34px);
            letter-spacing: -0.04em;
            margin: 10px 0 8px;
          }

          .dmc-login-heading p {
            color: ${Colors.muted};
            font-size: 14px;
            line-height: 1.6;
            margin: 0;
          }

          .dmc-login-form {
            margin-top: 34px;
          }

          .dmc-field {
            margin-bottom: 20px;
          }

          .dmc-field label,
          .dmc-password-header label {
            display: block;
            color: ${Colors.text};
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .dmc-input-wrapper {
            display: flex;
            align-items: center;
            height: 52px;
            border: 1px solid ${Colors.border};
            border-radius: 11px;
            background: ${Colors.white};
            transition:
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .dmc-input-wrapper:focus-within {
            border-color: ${Colors.red};
            box-shadow: 0 0 0 3px ${Colors.red}15;
          }

          .dmc-input-wrapper > svg {
            flex-shrink: 0;
            margin-left: 15px;
            color: ${Colors.muted};
          }

          .dmc-input-wrapper input {
            flex: 1;
            min-width: 0;
            height: 100%;
            border: none;
            outline: none;
            padding: 0 14px;
            font-size: 14px;
            color: ${Colors.text};
            background: transparent;
          }

          .dmc-input-wrapper input::placeholder {
            color: #98a2b3;
          }

          .dmc-password-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .dmc-password-header button {
            border: none;
            background: transparent;
            color: ${Colors.red};
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            padding: 0;
          }

          .dmc-password-toggle {
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0 15px;
            color: ${Colors.muted};
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .dmc-remember {
            display: flex;
            align-items: center;
            gap: 9px;
            color: ${Colors.muted};
            font-size: 12px;
            cursor: pointer;
          }

          .dmc-remember input {
            width: 15px;
            height: 15px;
            margin: 0;
            accent-color: ${Colors.red};
          }

          .dmc-error {
            margin-top: 16px;
            padding: 11px 13px;
            border-radius: 9px;
            background: ${Colors.redLight};
            color: ${Colors.redDark};
            font-size: 12px;
            line-height: 1.5;
          }

          .dmc-submit-button {
            width: 100%;
            height: 53px;
            margin-top: 25px;
            border: none;
            border-radius: 11px;
            background: ${Colors.red};
            color: ${Colors.white};
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.01em;
            cursor: pointer;
            box-shadow: 0 10px 25px ${Colors.red}30;
            transition:
              transform 160ms ease,
              box-shadow 160ms ease,
              background 160ms ease;
          }

          .dmc-submit-button:hover {
            background: ${Colors.redDark};
            transform: translateY(-1px);
            box-shadow: 0 14px 30px ${Colors.red}35;
          }

          .dmc-security-notice {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            margin-top: 30px;
            padding: 14px;
            border-radius: 11px;
            background: ${Colors.background};
            border: 1px solid ${Colors.border};
          }

          .dmc-security-notice > svg {
            flex-shrink: 0;
            color: ${Colors.navyLight};
            margin-top: 1px;
          }

          .dmc-security-notice div {
            display: flex;
            flex-direction: column;
          }

          .dmc-security-notice strong {
            color: ${Colors.text};
            font-size: 11px;
            font-weight: 800;
          }

          .dmc-security-notice span {
            color: ${Colors.muted};
            font-size: 10px;
            line-height: 1.5;
            margin-top: 3px;
          }

          .dmc-login-footer {
            text-align: center;
            color: #98a2b3;
            font-size: 10px;
            margin-top: 28px;
          }

          /* =========================
             TABLET
          ========================= */

          @media (max-width: 1050px) and (min-width: 701px) {
            .dmc-operations-panel {
              padding: 32px;
            }

            .dmc-operations-main {
              margin-top: 80px;
            }

            .dmc-operations-main h1 {
              font-size: clamp(34px, 5vw, 48px);
            }

            .dmc-feature-grid {
              grid-template-columns: 1fr;
              max-width: 220px;
            }

            .dmc-login-panel {
              width: 46%;
              padding: 30px;
            }
          }

          /* =========================
             MOBILE APP
          ========================= */

          @media (max-width: 700px) {
            .dmc-login-page {
              background: ${Colors.background};
              display: block;
              min-height: 100dvh;
            }

            .dmc-operations-panel {
              display: none;
            }

            .dmc-login-panel {
              width: 100%;
              min-height: 100dvh;
              padding: 0;
              background: ${Colors.background};
              align-items: flex-start;
            }

            .dmc-login-container {
              width: 100%;
              max-width: 520px;
              min-height: 100dvh;
              margin: 0 auto;
              padding: 28px 20px 24px;
              background: ${Colors.white};
              display: flex;
              flex-direction: column;
            }

            .dmc-mobile-brand {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 42px;
            }

            .dmc-mobile-brand-icon {
              width: 42px;
              height: 42px;
              border-radius: 12px;
              background: ${Colors.red};
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 8px 20px ${Colors.red}25;
            }

            .dmc-mobile-brand strong {
              display: block;
              color: ${Colors.navy};
              font-size: 20px;
              line-height: 1;
            }

            .dmc-mobile-brand small {
              display: block;
              color: ${Colors.muted};
              font-size: 8px;
              font-weight: 800;
              letter-spacing: 0.08em;
              margin-top: 4px;
            }

            .dmc-login-heading h2 {
              font-size: 30px;
            }

            .dmc-login-form {
              margin-top: 30px;
            }

            .dmc-field {
              margin-bottom: 18px;
            }

            .dmc-input-wrapper {
              height: 54px;
              border-radius: 12px;
            }

            .dmc-submit-button {
              height: 54px;
              border-radius: 12px;
              margin-top: 24px;
            }

            .dmc-security-notice {
              margin-top: 24px;
            }

            .dmc-login-footer {
              margin-top: auto;
              padding-top: 30px;
            }
          }

          @media (max-width: 380px) {
            .dmc-login-container {
              padding-left: 16px;
              padding-right: 16px;
            }

            .dmc-mobile-brand {
              margin-bottom: 34px;
            }

            .dmc-login-heading h2 {
              font-size: 27px;
            }

            .dmc-login-heading p {
              font-size: 13px;
            }

            .dmc-input-wrapper {
              height: 52px;
            }

            .dmc-submit-button {
              height: 52px;
            }

            .dmc-security-notice {
              padding: 12px;
            }
          }

          @media (max-height: 650px) and (max-width: 700px) {
            .dmc-login-container {
              padding-top: 18px;
            }

            .dmc-mobile-brand {
              margin-bottom: 24px;
            }

            .dmc-login-form {
              margin-top: 22px;
            }

            .dmc-field {
              margin-bottom: 14px;
            }

            .dmc-security-notice {
              margin-top: 18px;
            }
          }
        `}
      </style>
    </div>
  );
}

