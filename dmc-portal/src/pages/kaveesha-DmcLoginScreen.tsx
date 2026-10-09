
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowRight,
  CircleAlert,
  Clock,
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
  onLogin: (email: string, password: string) => Promise<void>;
  onShowRegistration?: () => void;
  onShowAdminLogin?: () => void;
}

export default function KaveeshaDmcLoginScreen({
  onLogin,
  onShowRegistration,
  onShowAdminLogin,
}: DmcLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  const colomboTime = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Colombo",
    hour12: false,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your DMC email and password.");
      return;
    }

    setSubmitting(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dmc-login-page">
      {/* Desktop / Tablet operations panel */}
      <section className="dmc-operations-panel">
        <div className="dmc-panel-aurora dmc-aurora-red" />
        <div className="dmc-panel-aurora dmc-aurora-blue" />
        <div className="dmc-panel-grid" />

        <div className="dmc-radar" aria-hidden="true">
          <span className="dmc-radar-ring dmc-radar-ring-1" />
          <span className="dmc-radar-ring dmc-radar-ring-2" />
          <span className="dmc-radar-ring dmc-radar-ring-3" />
          <span className="dmc-radar-sweep" />
          <span className="dmc-radar-core" />
        </div>

        <div className="dmc-operations-content">
          {/* Brand */}
          <div className="dmc-brand">
            <div className="dmc-brand-icon">
              <ShieldCheck size={24} />
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
              <span className="dmc-badge-dot" />
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
              <div className="dmc-feature-icon">
                <Radio size={17} />
              </div>
              <strong>Live Alerts</strong>
              <span>Real-time updates</span>
            </div>

            <div className="dmc-feature-card">
              <div className="dmc-feature-icon">
                <Activity size={17} />
              </div>
              <strong>Response</strong>
              <span>Team coordination</span>
            </div>

            <div className="dmc-feature-card">
              <div className="dmc-feature-icon">
                <ShieldCheck size={17} />
              </div>
              <strong>Secure</strong>
              <span>Role-based access</span>
            </div>
          </div>
        </div>

        <div className="dmc-operations-footer">
          <div className="dmc-system-status">
            <span className="dmc-status-dot" />
            ALL SYSTEMS OPERATIONAL
          </div>

          <div className="dmc-system-time">
            <Clock size={13} />
            {colomboTime}
            <span>COLOMBO</span>
          </div>
        </div>
      </section>

      {/* Login panel */}
      <section className="dmc-login-panel">
        <div className="dmc-login-glow dmc-login-glow-red" />
        <div className="dmc-login-glow dmc-login-glow-blue" />

        {/* Mobile hero */}
        <div className="dmc-mobile-hero">
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

          <p className="dmc-mobile-hero-text">
            Secure access to Sri Lanka's emergency coordination network.
          </p>

          <div className="dmc-mobile-chip">
            <span className="dmc-status-dot" />
            SECURE CHANNEL ACTIVE
          </div>
        </div>

        <div className="dmc-login-container">
          <div className="dmc-login-card">
            {/* Heading */}
            <div className="dmc-login-heading">
              <div className="dmc-login-label">
                <LockKeyhole size={12} />
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
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
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
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />

                <span>Keep me signed in</span>
              </label>

              {error && (
                <div className="dmc-error" role="alert">
                  <CircleAlert size={16} />

                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="dmc-submit-button"
                disabled={submitting}
              >
                <span>
                  {submitting
                    ? "Signing in..."
                    : "Sign in to DMC Portal"}
                </span>

                {!submitting && <ArrowRight size={17} />}
              </button>

              {(onShowRegistration || onShowAdminLogin) && (
                <div className="dmc-alt-actions">
                  {onShowRegistration && (
                    <div className="dmc-register-link">
                      <span>New to SafePlus?</span>

                      <button
                        type="button"
                        onClick={onShowRegistration}
                      >
                        Create an account
                      </button>
                    </div>
                  )}

                  {onShowAdminLogin && (
                    <div className="dmc-register-link">
                      <span>Are you an administrator?</span>

                      <button
                        type="button"
                        onClick={onShowAdminLogin}
                      >
                        Admin login
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Security notice */}
            <div className="dmc-security-notice">
              <div className="dmc-security-icon">
                <ShieldCheck size={16} />
              </div>

              <div>
                <strong>Protected operations access</strong>

                <span>
                  This portal is restricted to authorized Disaster Management
                  Centre personnel.
                </span>
              </div>
            </div>
          </div>

          <div className="dmc-login-footer">
            SafePlus Emergency Coordination System
          </div>
        </div>
      </section>

      <style>
        {`
          .dmc-login-page,
          .dmc-login-page *,
          .dmc-login-page *::before,
          .dmc-login-page *::after {
            box-sizing: border-box;
          }

          .dmc-login-page {
            min-height: 100vh;
            min-height: 100dvh;
            width: 100%;
            display: flex;
            text-align: left;
            background: ${Colors.background};
            color: ${Colors.text};
            font-family:
              Inter,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          .dmc-login-page h1,
          .dmc-login-page h2 {
            font-family: inherit;
          }

          /* =========================
             OPERATIONS PANEL
          ========================= */

          .dmc-operations-panel {
            position: relative;
            flex: 1;
            min-width: 0;
            min-height: 100vh;
            padding: clamp(32px, 4.4vw, 64px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            color: ${Colors.white};
            background:
              radial-gradient(
                1100px 620px at 88% -12%,
                rgba(22, 58, 89, 0.9),
                transparent 62%
              ),
              radial-gradient(
                820px 560px at -8% 112%,
                rgba(217, 45, 32, 0.14),
                transparent 58%
              ),
              ${Colors.navy};
          }

          .dmc-panel-aurora {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            pointer-events: none;
          }

          .dmc-aurora-red {
            width: 520px;
            height: 520px;
            top: -190px;
            right: -150px;
            background: radial-gradient(
              circle,
              rgba(217, 45, 32, 0.4),
              transparent 62%
            );
            animation: dmcLoginDrift 18s ease-in-out infinite alternate;
          }

          .dmc-aurora-blue {
            width: 600px;
            height: 600px;
            bottom: -260px;
            left: -200px;
            background: radial-gradient(
              circle,
              rgba(21, 112, 239, 0.26),
              transparent 62%
            );
            animation: dmcLoginDrift 24s ease-in-out infinite alternate-reverse;
          }

          .dmc-panel-grid {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.14;
            background-image: radial-gradient(
              rgba(255, 255, 255, 0.4) 1px,
              transparent 1.4px
            );
            background-size: 34px 34px;
            -webkit-mask-image: radial-gradient(
              ellipse 95% 85% at 32% 22%,
              #000 18%,
              transparent 72%
            );
            mask-image: radial-gradient(
              ellipse 95% 85% at 32% 22%,
              #000 18%,
              transparent 72%
            );
          }

          .dmc-radar {
            position: absolute;
            top: 50%;
            right: -180px;
            width: 620px;
            height: 620px;
            transform: translateY(-54%);
            pointer-events: none;
          }

          .dmc-radar-ring {
            position: absolute;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.07);
          }

          .dmc-radar-ring-2 {
            inset: 90px;
            border-color: rgba(255, 255, 255, 0.05);
          }

          .dmc-radar-ring-3 {
            inset: 180px;
            border-color: rgba(217, 45, 32, 0.16);
          }

          .dmc-radar-sweep {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            opacity: 0.8;
            background: conic-gradient(
              from 0deg,
              rgba(217, 45, 32, 0.3),
              rgba(217, 45, 32, 0.05) 52deg,
              transparent 90deg
            );
            -webkit-mask-image: radial-gradient(
              circle,
              transparent 118px,
              #000 119px
            );
            mask-image: radial-gradient(
              circle,
              transparent 118px,
              #000 119px
            );
            animation: dmcLoginSpin 22s linear infinite;
          }

          .dmc-radar-core {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 8px;
            height: 8px;
            margin: -4px 0 0 -4px;
            border-radius: 50%;
            background: ${Colors.red};
            box-shadow:
              0 0 0 6px rgba(217, 45, 32, 0.18),
              0 0 22px rgba(217, 45, 32, 0.6);
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
            animation: dmcLoginRise 0.55s ease both;
          }

          .dmc-brand-icon {
            width: 50px;
            height: 50px;
            border-radius: 15px;
            background: linear-gradient(
              145deg,
              ${Colors.red},
              ${Colors.redDark}
            );
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow:
              0 12px 30px -8px rgba(217, 45, 32, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
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
            max-width: 760px;
            margin-top: clamp(48px, 9vh, 120px);
            animation: dmcLoginRise 0.6s 0.06s ease both;
          }

          .dmc-emergency-badge {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(217, 45, 32, 0.14);
            border: 1px solid rgba(217, 45, 32, 0.3);
            color: #fda29b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.1em;
          }

          .dmc-badge-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: ${Colors.red};
            animation: dmcLoginPulseRed 2.2s ease-out infinite;
          }

          .dmc-operations-main h1 {
            color: ${Colors.white};
            font-size: clamp(36px, 3.7vw, 62px);
            line-height: 1.06;
            letter-spacing: -0.045em;
            margin: 24px 0 0;
            font-weight: 800;
            text-wrap: balance;
          }

          .dmc-operations-main h1 span {
            color: #fda29b;
          }

          .dmc-operations-main p {
            max-width: 520px;
            color: #98a2b3;
            font-size: 15px;
            line-height: 1.75;
            margin: 22px 0 0;
          }

          .dmc-feature-grid {
            position: relative;
            z-index: 2;
            display: grid;
            grid-template-columns: repeat(3, minmax(130px, 195px));
            gap: 14px;
            margin-top: 44px;
            animation: dmcLoginRise 0.6s 0.14s ease both;
          }

          .dmc-feature-card {
            padding: 16px;
            border-radius: 16px;
            background: linear-gradient(
              160deg,
              rgba(255, 255, 255, 0.1),
              rgba(255, 255, 255, 0.03)
            );
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            transition:
              transform 0.25s ease,
              border-color 0.25s ease,
              box-shadow 0.25s ease;
          }

          .dmc-feature-card:hover {
            transform: translateY(-4px);
            border-color: rgba(217, 45, 32, 0.45);
            box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.5);
          }

          .dmc-feature-icon {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(217, 45, 32, 0.16);
            color: #fda29b;
          }

          .dmc-feature-card strong {
            font-size: 12.5px;
            font-weight: 800;
          }

          .dmc-feature-card > span {
            margin-top: 3px;
            font-size: 10.5px;
            color: #98a2b3;
          }

          .dmc-operations-footer {
            position: relative;
            z-index: 2;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-top: clamp(24px, 4vh, 42px);
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.08em;
            animation: dmcLoginRise 0.6s 0.2s ease both;
          }

          .dmc-system-status {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            color: #98a2b3;
          }

          .dmc-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${Colors.success};
            animation: dmcLoginPulse 2.4s ease-out infinite;
          }

          .dmc-system-time {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #667085;
            font-variant-numeric: tabular-nums;
          }

          .dmc-system-time span {
            padding-left: 9px;
            border-left: 1px solid rgba(255, 255, 255, 0.12);
            color: #98a2b3;
            letter-spacing: 0.12em;
          }

          /* =========================
             LOGIN PANEL
          ========================= */

          .dmc-login-panel {
            position: relative;
            width: min(530px, 44%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            overflow: hidden;
            background:
              radial-gradient(
                720px 460px at 112% -8%,
                rgba(217, 45, 32, 0.055),
                transparent 62%
              ),
              radial-gradient(
                640px 460px at -18% 108%,
                rgba(21, 112, 239, 0.05),
                transparent 62%
              ),
              ${Colors.white};
          }

          .dmc-login-glow {
            position: absolute;
            border-radius: 50%;
            filter: blur(70px);
            pointer-events: none;
          }

          .dmc-login-glow-red {
            width: 380px;
            height: 380px;
            top: -150px;
            right: -130px;
            background: radial-gradient(
              circle,
              rgba(217, 45, 32, 0.1),
              transparent 65%
            );
          }

          .dmc-login-glow-blue {
            width: 420px;
            height: 420px;
            bottom: -170px;
            left: -150px;
            background: radial-gradient(
              circle,
              rgba(21, 112, 239, 0.09),
              transparent 65%
            );
          }

          .dmc-mobile-hero {
            display: none;
          }

          .dmc-login-container {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 408px;
            display: flex;
            flex-direction: column;
          }

          .dmc-login-card {
            padding: 34px 30px 26px;
            border-radius: 26px;
            background: linear-gradient(
              180deg,
              ${Colors.white} 0%,
              #fcfcfd 100%
            );
            border: 1px solid rgba(16, 24, 40, 0.07);
            box-shadow:
              0 30px 70px -30px rgba(11, 31, 51, 0.22),
              0 6px 18px -12px rgba(11, 31, 51, 0.1);
          }

          .dmc-login-heading {
            animation: dmcLoginRise 0.55s 0.05s ease both;
          }

          .dmc-login-label {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 7px 12px;
            border-radius: 999px;
            background: ${Colors.redLight};
            color: ${Colors.redDark};
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.1em;
          }

          .dmc-login-heading h2 {
            color: ${Colors.text};
            font-size: clamp(28px, 3vw, 32px);
            letter-spacing: -0.04em;
            margin: 16px 0 8px;
            font-weight: 800;
          }

          .dmc-login-heading p {
            color: ${Colors.muted};
            font-size: 14px;
            line-height: 1.65;
            margin: 0;
          }

          .dmc-login-form {
            margin-top: 26px;
            animation: dmcLoginRise 0.55s 0.12s ease both;
          }

          .dmc-field {
            margin-bottom: 18px;
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
            height: 54px;
            border: 1.5px solid transparent;
            border-radius: 14px;
            background: ${Colors.background};
            transition:
              border-color 0.18s ease,
              box-shadow 0.18s ease;
          }

          .dmc-input-wrapper:focus-within {
            border-color: ${Colors.red};
            box-shadow: 0 0 0 4px rgba(217, 45, 32, 0.1);
          }

          .dmc-input-wrapper > svg {
            flex-shrink: 0;
            margin-left: 16px;
            color: ${Colors.muted};
            transition: color 0.18s ease;
          }

          .dmc-input-wrapper:focus-within > svg {
            color: ${Colors.red};
          }

          .dmc-input-wrapper input {
            flex: 1;
            min-width: 0;
            height: 100%;
            border: none;
            outline: none;
            padding: 0 14px;
            font-family: inherit;
            font-size: 14px;
            color: ${Colors.text};
            background: transparent;
          }

          .dmc-input-wrapper input::placeholder {
            color: #98a2b3;
          }

          .dmc-input-wrapper input:-webkit-autofill {
            -webkit-box-shadow: 0 0 0 40px ${Colors.background} inset;
            -webkit-text-fill-color: ${Colors.text};
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
            transition: color 0.16s ease;
          }

          .dmc-password-header button:hover {
            color: ${Colors.redDark};
          }

          .dmc-password-toggle {
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 0 16px;
            color: ${Colors.muted};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.16s ease;
          }

          .dmc-password-toggle:hover {
            color: ${Colors.text};
          }

          .dmc-remember {
            display: flex;
            align-items: center;
            gap: 10px;
            color: ${Colors.muted};
            font-size: 13px;
            cursor: pointer;
            user-select: none;
            width: fit-content;
          }

          .dmc-remember input {
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            margin: 0;
            border-radius: 6px;
            border: 1.5px solid ${Colors.border};
            background: ${Colors.white};
            position: relative;
            cursor: pointer;
            transition:
              background 0.16s ease,
              border-color 0.16s ease,
              box-shadow 0.16s ease;
          }

          .dmc-remember input:checked {
            background: ${Colors.red};
            border-color: ${Colors.red};
          }

          .dmc-remember input:checked::after {
            content: "";
            position: absolute;
            left: 5px;
            top: 2px;
            width: 4px;
            height: 8px;
            border: solid ${Colors.white};
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }

          .dmc-remember input:focus-visible {
            outline: none;
            box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.15);
          }

          .dmc-error {
            display: flex;
            align-items: flex-start;
            gap: 9px;
            margin-top: 16px;
            padding: 12px 14px;
            border-radius: 12px;
            background: ${Colors.redLight};
            border: 1px solid rgba(217, 45, 32, 0.25);
            color: ${Colors.redDark};
            font-size: 12px;
            line-height: 1.5;
            animation: dmcLoginShake 0.35s ease;
          }

          .dmc-error svg {
            flex-shrink: 0;
            margin-top: 1px;
          }

          .dmc-submit-button {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            width: 100%;
            height: 54px;
            margin-top: 22px;
            border: none;
            border-radius: 14px;
            overflow: hidden;
            background: linear-gradient(
              135deg,
              ${Colors.red} 0%,
              ${Colors.redDark} 100%
            );
            color: ${Colors.white};
            font-family: inherit;
            font-size: 13.5px;
            font-weight: 800;
            letter-spacing: 0.01em;
            cursor: pointer;
            box-shadow:
              0 14px 30px -10px rgba(217, 45, 32, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
            transition:
              transform 0.18s ease,
              box-shadow 0.18s ease,
              filter 0.18s ease;
          }

          .dmc-submit-button::before {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            width: 55%;
            left: -80%;
            background: linear-gradient(
              100deg,
              transparent,
              rgba(255, 255, 255, 0.32),
              transparent
            );
            transform: skewX(-18deg);
            transition: left 0.65s ease;
          }

          .dmc-submit-button:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(1.05);
            box-shadow:
              0 18px 36px -10px rgba(217, 45, 32, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
          }

          .dmc-submit-button:hover:not(:disabled)::before {
            left: 125%;
          }

          .dmc-submit-button svg {
            transition: transform 0.22s ease;
          }

          .dmc-submit-button:hover:not(:disabled) svg {
            transform: translateX(3px);
          }

          .dmc-submit-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .dmc-alt-actions {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            margin-top: 20px;
            padding-top: 18px;
            border-top: 1px dashed ${Colors.border};
          }

          .dmc-register-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: ${Colors.muted};
            font-size: 13px;
          }

          .dmc-register-link button {
            border: none;
            background: transparent;
            color: ${Colors.red};
            font-family: inherit;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            padding: 0;
            transition: color 0.16s ease;
          }

          .dmc-register-link button:hover {
            color: ${Colors.redDark};
            text-decoration: underline;
          }

          .dmc-security-notice {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            margin-top: 24px;
            padding: 14px;
            border-radius: 14px;
            background: linear-gradient(
              160deg,
              ${Colors.background},
              ${Colors.white}
            );
            border: 1px solid ${Colors.border};
            animation: dmcLoginRise 0.55s 0.18s ease both;
          }

          .dmc-security-icon {
            flex-shrink: 0;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${Colors.blueLight};
            color: ${Colors.navyLight};
          }

          .dmc-security-notice div {
            display: flex;
            flex-direction: column;
          }

          .dmc-security-notice strong {
            color: ${Colors.text};
            font-size: 11.5px;
            font-weight: 800;
          }

          .dmc-security-notice span {
            color: ${Colors.muted};
            font-size: 10.5px;
            line-height: 1.55;
            margin-top: 3px;
          }

          .dmc-login-footer {
            margin-top: 20px;
            text-align: center;
            color: #98a2b3;
            font-size: 10px;
            letter-spacing: 0.04em;
          }

          /* =========================
             ANIMATIONS
          ========================= */

          @keyframes dmcLoginRise {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes dmcLoginDrift {
            from {
              transform: translate3d(0, 0, 0) scale(1);
            }
            to {
              transform: translate3d(-36px, 26px, 0) scale(1.1);
            }
          }

          @keyframes dmcLoginSpin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes dmcLoginPulse {
            0% {
              box-shadow: 0 0 0 0 rgba(18, 183, 106, 0.45);
            }
            70% {
              box-shadow: 0 0 0 7px rgba(18, 183, 106, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(18, 183, 106, 0);
            }
          }

          @keyframes dmcLoginPulseRed {
            0% {
              box-shadow: 0 0 0 0 rgba(217, 45, 32, 0.55);
            }
            70% {
              box-shadow: 0 0 0 7px rgba(217, 45, 32, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(217, 45, 32, 0);
            }
          }

          @keyframes dmcLoginShake {
            0%,
            100% {
              transform: translateX(0);
            }
            25% {
              transform: translateX(-4px);
            }
            75% {
              transform: translateX(4px);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .dmc-login-page *,
            .dmc-login-page *::before,
            .dmc-login-page *::after {
              animation-duration: 0.001ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.001ms !important;
            }
          }

          /* =========================
             TABLET
          ========================= */

          @media (max-width: 1050px) and (min-width: 701px) {
            .dmc-operations-panel {
              padding: 36px;
            }

            .dmc-radar {
              display: none;
            }

            .dmc-operations-main {
              margin-top: 64px;
            }

            .dmc-operations-main h1 {
              font-size: clamp(30px, 3.8vw, 42px);
            }

            .dmc-feature-grid {
              grid-template-columns: 1fr;
              max-width: 215px;
              margin-top: 38px;
            }

            .dmc-login-panel {
              width: 46%;
              padding: 32px;
            }

            .dmc-login-card {
              padding: 32px 28px 26px;
            }
          }

          /* Tablet width + short window */

          @media (max-width: 1050px) and (min-width: 701px) and (max-height: 880px) {
            .dmc-operations-panel {
              padding-top: 30px;
              padding-bottom: 30px;
            }

            .dmc-operations-main {
              margin-top: 52px;
            }

            .dmc-feature-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              max-width: 444px;
              margin-top: 28px;
            }

            .dmc-feature-card {
              display: grid;
              grid-template-columns: auto 1fr;
              grid-template-rows: auto auto;
              column-gap: 10px;
              row-gap: 1px;
              align-items: center;
              padding: 12px 14px;
            }

            .dmc-feature-icon {
              grid-row: 1 / span 2;
              width: 30px;
              height: 30px;
              margin-bottom: 0;
            }

            .dmc-feature-card strong {
              font-size: 11.5px;
            }
          }

          /* =========================
             SHORT DESKTOP WINDOWS
          ========================= */

          @media (min-width: 701px) and (max-height: 880px) {
            .dmc-operations-panel {
              padding-top: 30px;
              padding-bottom: 30px;
            }

            .dmc-operations-main {
              margin-top: 34px;
            }

            .dmc-operations-footer {
              margin-top: 20px;
              padding-top: 16px;
            }

            .dmc-feature-grid {
              margin-top: 26px;
            }

            .dmc-login-panel {
              padding: 20px;
            }

            .dmc-login-card {
              padding: 24px 24px 18px;
            }

            .dmc-login-heading h2 {
              margin: 8px 0 5px;
            }

            .dmc-login-form {
              margin-top: 17px;
            }

            .dmc-field {
              margin-bottom: 12px;
            }

            .dmc-input-wrapper {
              height: 50px;
            }

            .dmc-submit-button {
              height: 50px;
              margin-top: 16px;
            }

            .dmc-alt-actions {
              margin-top: 14px;
              padding-top: 12px;
              gap: 8px;
            }

            .dmc-security-notice {
              margin-top: 15px;
            }

            .dmc-login-footer {
              margin-top: 12px;
            }
          }

          /* =========================
             MOBILE
          ========================= */

          @media (max-width: 700px) {
            .dmc-login-page {
              display: block;
            }

            .dmc-operations-panel {
              display: none;
            }

            .dmc-login-panel {
              display: block;
              width: 100%;
              min-height: 100dvh;
              padding: 0;
              overflow: visible;
              background: ${Colors.white};
            }

            .dmc-login-glow {
              display: none;
            }

            .dmc-mobile-hero {
              display: block;
              position: relative;
              padding: 28px 22px 62px;
              color: ${Colors.white};
              background:
                radial-gradient(
                  420px 260px at 85% -30%,
                  rgba(217, 45, 32, 0.35),
                  transparent 65%
                ),
                radial-gradient(
                  520px 320px at -20% 120%,
                  rgba(21, 112, 239, 0.25),
                  transparent 60%
                ),
                ${Colors.navy};
            }

            .dmc-mobile-brand {
              display: flex;
              align-items: center;
              gap: 11px;
              animation: dmcLoginRise 0.5s ease both;
            }

            .dmc-mobile-brand-icon {
              width: 44px;
              height: 44px;
              border-radius: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(
                145deg,
                ${Colors.red},
                ${Colors.redDark}
              );
              box-shadow:
                0 10px 24px -6px rgba(217, 45, 32, 0.55),
                inset 0 1px 0 rgba(255, 255, 255, 0.25);
            }

            .dmc-mobile-brand strong {
              display: block;
              color: ${Colors.white};
              font-size: 20px;
              line-height: 1;
            }

            .dmc-mobile-brand small {
              display: block;
              color: #98a2b3;
              font-size: 8px;
              font-weight: 800;
              letter-spacing: 0.08em;
              margin-top: 5px;
            }

            .dmc-mobile-hero-text {
              margin: 18px 0 0;
              max-width: 300px;
              color: #98a2b3;
              font-size: 12.5px;
              line-height: 1.6;
              animation: dmcLoginRise 0.5s 0.06s ease both;
            }

            .dmc-mobile-chip {
              display: inline-flex;
              align-items: center;
              gap: 9px;
              margin-top: 18px;
              padding: 7px 13px;
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.07);
              border: 1px solid rgba(255, 255, 255, 0.12);
              color: #98a2b3;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.1em;
              animation: dmcLoginRise 0.5s 0.1s ease both;
            }

            .dmc-login-container {
              position: relative;
              z-index: 1;
              width: 100%;
              max-width: 520px;
              min-height: calc(100dvh - 150px);
              margin: -46px auto 0;
              padding: 32px 20px 24px;
              border-radius: 28px 28px 0 0;
              background: ${Colors.white};
              display: flex;
              flex-direction: column;
              box-shadow: 0 -18px 40px -24px rgba(11, 31, 51, 0.35);
            }

            .dmc-login-card {
              padding: 0;
              border: none;
              border-radius: 0;
              background: transparent;
              box-shadow: none;
            }

            .dmc-login-heading h2 {
              font-size: 28px;
            }

            .dmc-login-form {
              margin-top: 26px;
            }

            .dmc-field {
              margin-bottom: 18px;
            }

            .dmc-submit-button {
              height: 54px;
            }

            .dmc-login-footer {
              margin-top: auto;
              padding-top: 32px;
            }
          }

          @media (max-width: 380px) {
            .dmc-login-container {
              padding-left: 16px;
              padding-right: 16px;
            }

            .dmc-mobile-hero {
              padding-left: 16px;
              padding-right: 16px;
            }

            .dmc-login-heading h2 {
              font-size: 26px;
            }

            .dmc-login-heading p {
              font-size: 13px;
            }

            .dmc-security-notice {
              padding: 12px;
            }
          }

          @media (max-height: 650px) and (max-width: 700px) {
            .dmc-mobile-hero {
              padding-top: 20px;
              padding-bottom: 54px;
            }

            .dmc-mobile-hero-text {
              display: none;
            }

            .dmc-mobile-chip {
              margin-top: 14px;
            }

            .dmc-login-container {
              padding-top: 24px;
            }

            .dmc-login-form {
              margin-top: 22px;
            }

            .dmc-field {
              margin-bottom: 14px;
            }
          }
        `}
      </style>
    </div>
  );
}
