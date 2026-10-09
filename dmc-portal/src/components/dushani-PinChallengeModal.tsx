import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Colors } from "../constants/theme";

const Hairline = "#EAECF0";
const Divider = "#F2F4F7";
const ShadowCard =
  "0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.06)";
const ShadowOverlay =
  "0 24px 48px -12px rgba(16, 24, 40, 0.26), 0 8px 20px -8px rgba(16, 24, 40, 0.16)";
const FocusRing = "0 0 0 3px rgba(217, 45, 32, 0.16)";
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

interface PinChallengeModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (pin: string) => void;
}

/**
 * Clearance for a live-warning action: the officer types the six digit PIN into
 * a dialog sitting over the middle of the screen, so an accidental click cannot
 * extend or stop an emergency alert.
 */
export default function PinChallengeModal({
  title,
  description,
  confirmLabel,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: PinChallengeModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const pin = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    }
  }, [error]);

  const setDigit = (index: number, raw: string) => {
    const next = [...digits];

    next[index] = raw.replace(/\D/g, "").slice(-1);
    setDigits(next);

    if (next[index] && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const pasteDigits = (raw: string) => {
    const found = raw.replace(/\D/g, "").slice(0, 6).split("");

    setDigits([0, 1, 2, 3, 4, 5].map((index) => found[index] ?? ""));
    inputs.current[Math.max(0, found.length - 1)]?.focus();
  };

  return (
    <div
      className="pin-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <div
        className="pin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-modal-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            onCancel();
          }
        }}
      >
        <div className="pin-modal-head">
          <span className="pin-modal-head-icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <h3 id="pin-modal-title">{title}</h3>
        </div>

        <p className="pin-modal-lead">{description}</p>

        <div className="pin-modal-box">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              className="pin-modal-digit"
              value={digit}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={2}
              aria-label={`Clearance PIN digit ${index + 1}`}
              disabled={busy}
              onChange={(event) => setDigit(index, event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                pasteDigits(event.clipboardData.getData("text"));
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !digit && index > 0) {
                  inputs.current[index - 1]?.focus();
                }

                if (event.key === "Enter" && pin.length === 6 && !busy) {
                  onConfirm(pin);
                }
              }}
            />
          ))}
        </div>

        {error && <p className="pin-modal-error">{error}</p>}

        <div className="pin-modal-actions">
          <button
            type="button"
            className="pin-modal-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="pin-modal-button pin-modal-button-confirm"
            onClick={() => onConfirm(pin)}
            disabled={busy || pin.length !== 6}
          >
            {busy ? <Loader2 className="pin-modal-spin" size={15} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{PIN_MODAL_STYLES}</style>
    </div>
  );
}

const PIN_MODAL_STYLES = `
  .pin-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(11, 31, 51, 0.55);
    backdrop-filter: saturate(140%) blur(3px);
    -webkit-backdrop-filter: saturate(140%) blur(3px);
  }

  .pin-modal {
    width: min(440px, 100%);
    background: ${Colors.white};
    border: 1px solid ${Hairline};
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: ${ShadowOverlay};
    color: ${Colors.text};
    font-variant-numeric: tabular-nums;
    animation: pin-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes pin-modal-in {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .pin-modal-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid ${Divider};
  }

  .pin-modal-head-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: ${Colors.redLight};
    color: ${Colors.redDark};
    border: 1px solid #FDA29B;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pin-modal-head h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.35;
    color: ${Colors.text};
  }

  .pin-modal-lead {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.55;
    color: ${Colors.muted};
  }

  .pin-modal-box {
    display: flex;
    gap: 10px;
    justify-content: center;
    padding: 4px 0 2px;
  }

  .pin-modal-digit {
    width: 54px;
    height: 46px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    text-align: center;
    font-family: ${Mono};
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    color: ${Colors.text};
    background: ${Colors.white};
    caret-color: ${Colors.red};
    box-shadow: ${ShadowCard};
    transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }

  .pin-modal-digit:not(:disabled):hover {
    border-color: ${Colors.navy};
  }

  .pin-modal-digit:focus-visible {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
    background: ${Colors.white};
  }

  .pin-modal-digit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .pin-modal-error {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid #FDA29B;
    border-radius: 10px;
    background: #FEF3F2;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.45;
    color: ${Colors.redDark};
    text-align: center;
  }

  .pin-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px solid ${Divider};
  }

  .pin-modal-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid ${Colors.border};
    background: ${Colors.white};
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: ${Colors.text};
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease,
      transform 140ms ease, box-shadow 140ms ease;
  }

  .pin-modal-button:hover:not(:disabled) {
    border-color: ${Colors.navy};
    color: ${Colors.navy};
    box-shadow: ${ShadowCard};
  }

  .pin-modal-button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .pin-modal-button:focus-visible {
    outline: none;
    border-color: ${Colors.red};
    box-shadow: ${FocusRing};
  }

  .pin-modal-button-confirm {
    border-color: ${Colors.red};
    background: ${Colors.red};
    color: ${Colors.white};
    box-shadow: 0 1px 3px rgba(217, 45, 32, 0.32);
  }

  .pin-modal-button-confirm:hover:not(:disabled) {
    background: ${Colors.redDark};
    border-color: ${Colors.redDark};
    color: ${Colors.white};
    box-shadow: 0 4px 12px -4px rgba(180, 35, 24, 0.5);
  }

  .pin-modal-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes pin-modal-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .pin-modal-spin {
    animation: pin-modal-spin 900ms linear infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .pin-modal,
    .pin-modal *,
    .pin-modal *::before,
    .pin-modal *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  @media (max-width: 480px) {
    .pin-modal-backdrop {
      padding: 14px;
    }

    .pin-modal {
      padding: 20px;
    }

    .pin-modal-box {
      gap: 8px;
    }

    .pin-modal-digit {
      width: 46px;
      height: 44px;
      font-size: 18px;
    }
  }
`;
