import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { Colors } from "../constants/theme";
import { adminLogin, AdminApiError } from "../services/amasha-adminApi";
import type { AdminUser } from "../types/auth";

interface AdminLoginScreenProps {
  onBack: () => void;
  onLoggedIn: (admin: AdminUser) => void;
}

export default function AdminLoginScreen({
  onBack,
  onLoggedIn,
}: AdminLoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your admin email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const admin = await adminLogin(email.trim(), password);
      onLoggedIn(admin);
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <button type="button" className="admin-back" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to DMC login
        </button>

        <div className="admin-brand">
          <div className="admin-brand-icon">
            <ShieldCheck size={24} />
          </div>
          <div>
            <strong>
              Safe<span>Plus</span>
            </strong>
            <small>SUPER ADMIN CONSOLE</small>
          </div>
        </div>

        <div className="admin-heading">
          <div className="admin-label">RESTRICTED ACCESS</div>
          <h2>Admin login</h2>
          <p>
            Sign in to review and verify registrations across the SafePlus
            platform.
          </p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-field">
            <label>Admin email</label>
            <div className="admin-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@safeplus.lk"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="admin-field">
            <label>Password</label>
            <div className="admin-input">
              <LockKeyhole size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <div className="admin-error">{error}</div>}

          <button type="submit" className="admin-submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in as Super Admin"}
          </button>
        </form>

        <div className="admin-footer">
          SafePlus Emergency Coordination System
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }

        .admin-login-page {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: ${Colors.navy};
          font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .admin-login-card {
          width: 100%;
          max-width: 430px;
          background: ${Colors.white};
          border-radius: 18px;
          padding: 32px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.35);
        }

        .admin-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          background: transparent;
          color: ${Colors.muted};
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
          margin-bottom: 22px;
        }
        .admin-back:hover { color: ${Colors.red}; }

        .admin-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .admin-brand-icon {
          width: 46px;
          height: 46px;
          border-radius: 13px;
          background: ${Colors.red};
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px ${Colors.red}30;
        }
        .admin-brand strong {
          display: block;
          color: ${Colors.navy};
          font-size: 20px;
          line-height: 1;
        }
        .admin-brand strong span { color: ${Colors.red}; }
        .admin-brand small {
          display: block;
          color: ${Colors.muted};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin-top: 4px;
        }

        .admin-heading { margin-top: 26px; }
        .admin-label {
          color: ${Colors.red};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.09em;
        }
        .admin-heading h2 {
          color: ${Colors.text};
          font-size: 30px;
          letter-spacing: -0.03em;
          margin: 8px 0 6px;
        }
        .admin-heading p {
          color: ${Colors.muted};
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }

        .admin-form { margin-top: 26px; }
        .admin-field { margin-bottom: 18px; }
        .admin-field label {
          display: block;
          color: ${Colors.text};
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .admin-input {
          display: flex;
          align-items: center;
          height: 52px;
          border: 1px solid ${Colors.border};
          border-radius: 11px;
          background: ${Colors.white};
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .admin-input:focus-within {
          border-color: ${Colors.red};
          box-shadow: 0 0 0 3px ${Colors.red}15;
        }
        .admin-input > svg {
          flex-shrink: 0;
          margin-left: 15px;
          color: ${Colors.muted};
        }
        .admin-input input {
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
        .admin-toggle {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0 15px;
          color: ${Colors.muted};
          display: flex;
          align-items: center;
        }

        .admin-error {
          margin-top: 4px;
          padding: 11px 13px;
          border-radius: 9px;
          background: ${Colors.redLight};
          color: ${Colors.redDark};
          font-size: 12px;
          line-height: 1.5;
        }

        .admin-submit {
          width: 100%;
          height: 52px;
          margin-top: 22px;
          border: none;
          border-radius: 11px;
          background: ${Colors.red};
          color: #fff;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 10px 25px ${Colors.red}30;
          transition: background 160ms ease, transform 160ms ease;
        }
        .admin-submit:hover:not(:disabled) {
          background: ${Colors.redDark};
          transform: translateY(-1px);
        }
        .admin-submit:disabled { opacity: 0.7; cursor: not-allowed; }

        .admin-footer {
          text-align: center;
          color: #98a2b3;
          font-size: 10px;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
