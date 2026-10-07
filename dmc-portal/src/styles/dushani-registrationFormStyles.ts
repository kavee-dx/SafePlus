import { Colors } from "../constants/theme";

export const REGISTRATION_FORM_CSS = `
  * {
    box-sizing: border-box;
  }

  .registration-page {
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

  .registration-hero {
    background: ${Colors.navy};
    padding: clamp(24px, 3vw, 36px) clamp(20px, 4vw, 48px) 112px;
  }

  .registration-hero-inner {
    max-width: 860px;
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
    margin-top: clamp(28px, 4vw, 40px);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
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
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  /* =========================
     FORM SECTIONS
  ========================= */

  .registration-main {
    flex: 1;
    width: 100%;
    max-width: 860px;
    margin: -80px auto 0;
    padding: 0 clamp(20px, 4vw, 48px) clamp(40px, 6vw, 72px);
  }

  .form-section {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 20px;
    padding: clamp(22px, 3vw, 30px);
    margin-bottom: 20px;
    box-shadow: 0 10px 30px rgba(11, 31, 51, 0.07);
  }

  .section-title {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid ${Colors.background};
  }

  .section-icon {
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .section-title h3 {
    font-size: 17px;
    font-weight: 800;
    color: ${Colors.navy};
    margin: 0 0 4px;
    letter-spacing: -0.02em;
  }

  .section-title p {
    font-size: 12.5px;
    color: ${Colors.muted};
    line-height: 1.5;
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }

  .form-field {
    display: flex;
    flex-direction: column;
  }

  .field-full {
    margin-top: 20px;
  }

  .form-field label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    font-weight: 700;
    color: ${Colors.navy};
    margin-bottom: 9px;
  }

  .optional-tag {
    padding: 3px 9px;
    border-radius: 999px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    height: 52px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.background};
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .input-wrapper:focus-within {
    border-color: ${Colors.blue};
    background: ${Colors.white};
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.14);
  }

  .input-wrapper.invalid {
    border-color: ${Colors.red};
    background: ${Colors.redLight};
  }

  .input-wrapper.invalid:focus-within {
    box-shadow: 0 0 0 3px rgba(217, 45, 32, 0.14);
  }

  .input-wrapper.locked {
    background: ${Colors.white};
    border-style: dashed;
  }

  .input-wrapper > svg {
    flex-shrink: 0;
    margin-left: 15px;
    color: ${Colors.muted};
  }

  .input-wrapper input,
  .input-wrapper select,
  .input-wrapper textarea {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    padding: 0 14px;
    font-size: 14.5px;
    color: ${Colors.text};
    background: transparent;
    font-family: inherit;
  }

  .input-wrapper textarea {
    padding: 14px;
    height: 118px;
    resize: vertical;
    line-height: 1.55;
  }

  .input-wrapper select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }

  .input-wrapper input[readonly] {
    color: ${Colors.muted};
    cursor: default;
  }

  .input-wrapper input::placeholder,
  .input-wrapper textarea::placeholder {
    color: #98a2b3;
  }

  .field-error {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 7px;
    color: ${Colors.redDark};
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.45;
  }

  .password-toggle {
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0 15px;
    color: ${Colors.muted};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .password-toggle:hover {
    color: ${Colors.blue};
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    border-radius: 16px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .form-actions {
    margin-top: 20px;
  }

  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 54px;
    border: none;
    border-radius: 14px;
    background: ${Colors.blue};
    color: ${Colors.white};
    font-family: inherit;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.01em;
    cursor: pointer;
    box-shadow: 0 12px 28px rgba(21, 112, 239, 0.28);
    transition:
      transform 160ms ease,
      box-shadow 160ms ease,
      background 160ms ease;
  }

  .submit-button:hover:not(:disabled) {
    background: ${Colors.blueDark};
    transform: translateY(-1px);
    box-shadow: 0 16px 34px rgba(21, 112, 239, 0.34);
  }

  .submit-button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .registration-notice {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: 4px;
    padding: 18px 20px;
    border-radius: 16px;
    background: ${Colors.amberLight};
    border: 1px solid ${Colors.amber};
  }

  .registration-notice svg {
    flex-shrink: 0;
    color: ${Colors.amberText};
    margin-top: 2px;
  }

  .registration-notice strong {
    display: block;
    color: ${Colors.navy};
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 4px;
  }

  .registration-notice span {
    display: block;
    color: ${Colors.muted};
    font-size: 12px;
    line-height: 1.6;
  }

  /* =========================
     RESPONSIVE
  ========================= */

  @media (max-width: 768px) {
    .registration-hero {
      padding-bottom: 100px;
    }

    .registration-main {
      margin-top: -68px;
    }

    .form-section {
      padding: 22px 20px;
    }

    .form-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .input-wrapper {
      height: 54px;
    }

    .submit-button {
      height: 55px;
    }

    .hero-heading {
      flex-direction: column;
      align-items: flex-start;
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
  }
`;
