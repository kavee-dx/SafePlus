import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  AlertApiError,
  fetchPinStatus,
  setPin,
  type PinStatus,
} from "../services/dushani-alertApi";

const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const Surface = "#F9FAFB";
const GreenTint = "#DCFCE7";
const GreenText = "#166534";
const RedTint = "#FEF3F2";
const ShadowCard =
  "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)";
const FocusRing = "0 0 0 3px rgba(217, 45, 32, 0.16)";
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const PIN_RULES = [
  "Exactly 6 digits.",
  "No repeats such as 111111.",
  "No runs such as 123456 or 987654.",
];

export default function ClearancePinCard() {
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPinStatus()
      .then((result) => {
        setStatus(result);
        setLoadError(null);
      })
      .catch((statusError) => {
        setLoadError(errorMessage(statusError));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reloadToken]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSavedAt(null);

    if (pin !== confirmPin) {
      setSaving(false);
      setFieldErrors({ confirmPin: "The two PINs do not match." });
      return;
    }

    try {
      await setPin(pin, currentPin || undefined);

      setPinValue("");
      setConfirmPin("");
      setCurrentPin("");
      setSavedAt(new Date().toLocaleString());
      setReloadToken((current) => current + 1);
    } catch (saveError) {
      if (saveError instanceof AlertApiError) {
        setError(saveError.message);
        setFieldErrors(saveError.fieldErrors);
      } else {
        setError(errorMessage(saveError));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pin-page">
      <div className="pin-card">
        <div className="pin-card-header">
          <div className="pin-card-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2>Operational clearance PIN</h2>
            <p>
              Every broadcast must be authorized with your own PIN. Only its
              bcrypt hash is stored, and a wrong PIN halts the broadcast and is
              written to the audit log.
            </p>
          </div>
        </div>

        {loading && (
          <div className="pin-state">
            <Loader2 className="spin" size={18} /> Loading status…
          </div>
        )}

        {!loading && loadError && (
          <div className="pin-banner pin-banner-error">
            <AlertTriangle size={16} /> {loadError}
          </div>
        )}

        {!loading && status && !status.isOfficer && (
          <div className="pin-banner pin-banner-error">
            <AlertTriangle size={16} /> This account is not a DMC officer, so it
            cannot hold a clearance PIN.
          </div>
        )}

        {!loading && status && status.isOfficer && (
          <>
            <div
              className={`pin-banner ${
                status.hasPin ? "pin-banner-ok" : "pin-banner-warn"
              }`}
            >
              {status.hasPin ? <CheckCircle size={16} /> : <KeyRound size={16} />}
              <span>
                {status.hasPin
                  ? `PIN is set${status.pinUpdatedAt ? ` (last changed ${new Date(
                      status.pinUpdatedAt
                    ).toLocaleDateString()})` : ""}. Broadcasting is authorized by it.`
                  : "No PIN yet. You cannot broadcast until one is set."}
              </span>
            </div>

            <form className="pin-form" onSubmit={handleSubmit}>
              <div className="pin-field">
                <label htmlFor="pin-new">
                  {status.hasPin ? "New PIN" : "Choose a 6 digit PIN"}
                </label>
                <input
                  id="pin-new"
                  value={pin}
                  onChange={(event) => setPinValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="••••••"
                  maxLength={6}
                />
                {fieldErrors.pin && (
                  <span className="pin-field-error">{fieldErrors.pin}</span>
                )}
              </div>

              <div className="pin-field">
                <label htmlFor="pin-confirm">Confirm PIN</label>
                <input
                  id="pin-confirm"
                  value={confirmPin}
                  onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••••"
                  maxLength={6}
                />
                {fieldErrors.confirmPin && (
                  <span className="pin-field-error">{fieldErrors.confirmPin}</span>
                )}
              </div>

              {status.hasPin && (
                <div className="pin-field">
                  <label htmlFor="pin-current">Current PIN</label>
                  <input
                    id="pin-current"
                    value={currentPin}
                    onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="••••••"
                    maxLength={6}
                  />
                  {fieldErrors.currentPin && (
                    <span className="pin-field-error">{fieldErrors.currentPin}</span>
                  )}
                </div>
              )}

              <ul className="pin-rules">
                {PIN_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>

              {error && (
                <div className="pin-banner pin-banner-error">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}

              {savedAt && (
                <div className="pin-banner pin-banner-ok">
                  <CheckCircle size={16} /> PIN saved at {savedAt}.
                </div>
              )}

              <button
                type="submit"
                className="pin-submit"
                disabled={saving || pin.length !== 6 || confirmPin.length !== 6}
              >
                {saving ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
                {status.hasPin ? "Change PIN" : "Set PIN"}
              </button>
            </form>
          </>
        )}
      </div>

      <style>
        {`
          .pin-page {
            display: flex;
            justify-content: center;
          }

          .pin-card {
            width: 100%;
            max-width: 620px;
            background: ${Colors.white};
            border: 1px solid ${Hairline};
            border-radius: 18px;
            padding: 28px;
            box-shadow: ${ShadowCard};
          }

          .pin-card-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 22px;
            padding-bottom: 20px;
            border-bottom: 1px solid ${Divider};
          }

          .pin-card-icon {
            width: 46px;
            height: 46px;
            border-radius: 12px;
            background: ${Colors.redLight};
            color: ${Colors.redDark};
            border: 1px solid #FDA29B;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .pin-card-header h2 {
            margin: 0 0 6px;
            font-size: 19px;
            font-weight: 800;
            color: ${Colors.text};
            letter-spacing: -0.02em;
            line-height: 1.25;
          }

          .pin-card-header p {
            margin: 0;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.6;
            color: ${Colors.muted};
          }

          .pin-state {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0 0 18px;
            padding: 14px 16px;
            border: 1px dashed ${Colors.border};
            border-radius: 12px;
            background: ${Surface};
            font-size: 13px;
            font-weight: 600;
            color: ${Colors.muted};
          }

          .pin-banner {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 14px;
            border: 1px solid transparent;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.5;
            margin-bottom: 18px;
          }

          .pin-banner svg {
            flex-shrink: 0;
            margin-top: 2px;
          }

          .pin-banner-ok {
            background: ${GreenTint};
            color: ${GreenText};
            border-color: #A7F3C0;
          }

          .pin-banner-warn {
            background: ${Colors.amberLight};
            color: ${Colors.amberText};
            border-color: #FDCF5F;
          }

          .pin-banner-error {
            background: ${RedTint};
            color: ${Colors.redDark};
            border-color: #FDA29B;
          }

          .pin-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .pin-field label {
            display: block;
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            color: ${Colors.muted};
            margin-bottom: 6px;
          }

          .pin-field input {
            width: 100%;
            height: 44px;
            border: 1px solid ${Colors.border};
            border-radius: 10px;
            padding: 0 14px;
            font-family: ${Mono};
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.28em;
            font-variant-numeric: tabular-nums;
            color: ${Colors.text};
            background: ${Colors.white};
            caret-color: ${Colors.red};
            transition: border-color 140ms ease, box-shadow 140ms ease;
          }

          .pin-field input:hover:not(:disabled) {
            border-color: ${Colors.navy};
          }

          .pin-field input:focus {
            outline: none;
            border-color: ${Colors.red};
            box-shadow: ${FocusRing};
          }

          .pin-field input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .pin-field-error {
            display: block;
            margin-top: 6px;
            font-size: 12px;
            font-weight: 600;
            color: ${Colors.redDark};
          }

          .pin-rules {
            list-style: none;
            margin: 0;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: ${Surface};
            border: 1px solid ${Hairline};
            border-radius: 12px;
            font-size: 12px;
            color: ${Colors.muted};
          }

          .pin-rules li {
            position: relative;
            padding-left: 16px;
            line-height: 1.5;
            font-weight: 500;
          }

          .pin-rules li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 8px;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${Colors.border};
          }

          .pin-submit {
            align-self: flex-start;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            height: 44px;
            padding: 0 22px;
            border: 1px solid ${Colors.red};
            border-radius: 10px;
            background: ${Colors.red};
            color: ${Colors.white};
            font-family: inherit;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(217, 45, 32, 0.32);
            transition: background 140ms ease, border-color 140ms ease,
              box-shadow 140ms ease, transform 140ms ease;
          }

          .pin-submit:hover:not(:disabled) {
            background: ${Colors.redDark};
            border-color: ${Colors.redDark};
            box-shadow: 0 4px 12px -4px rgba(180, 35, 24, 0.5);
          }

          .pin-submit:active:not(:disabled) {
            transform: translateY(1px);
          }

          .pin-submit:focus-visible {
            outline: none;
            border-color: ${Colors.red};
            box-shadow: ${FocusRing};
          }

          .pin-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
          }

          .spin {
            animation: pin-spin 900ms linear infinite;
          }

          @keyframes pin-spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .pin-card *,
            .pin-card *::before,
            .pin-card *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }

          @media (max-width: 640px) {
            .pin-card {
              padding: 20px;
            }

            .pin-card-header {
              flex-direction: column;
              gap: 12px;
            }

            .pin-submit {
              align-self: stretch;
              justify-content: center;
            }
          }
        `}
      </style>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof AlertApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}
