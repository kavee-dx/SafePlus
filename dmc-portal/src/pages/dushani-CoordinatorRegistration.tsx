import { useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
  Truck,
  User,
  UserCircle,
} from "lucide-react";

import { Colors } from "../constants/theme";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  username as usernameRule,
  type FieldErrors,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface CoordinatorRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ROLE = "Relief Operations Coordinator";

const RULES: Record<string, Validator> = {
  fullName: requiredRule("Full name"),
  email: emailRule,
  contactNumber: phoneRule,
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

function wrapperClass(errors: FieldErrors, field: string): string {
  return errors[field] ? "input-wrapper invalid" : "input-wrapper";
}

export default function CoordinatorRegistration({
  onBack,
  onSuccess,
}: CoordinatorRegistrationProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    formData,
    errors,
    submitError,
    isSubmitting,
    setField,
    blurField,
    submit,
  } = useRegistrationForm({
    initialValues: {
      fullName: "",
      email: "",
      contactNumber: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("coordinator", values),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="coordinator-registration-page">
      <header className="registration-hero">
        <div className="registration-hero-inner">
          <div className="hero-top">
            <button className="back-button" onClick={onBack}>
              <ArrowLeft size={18} />
              Back
            </button>

            <div className="brand">
              <div className="brand-icon">
                <Truck size={20} />
              </div>
              <div>
                <div className="brand-name">
                  Safe<span>Plus</span>
                </div>
                <div className="brand-subtitle">DMC PORTAL REGISTRATION</div>
              </div>
            </div>
          </div>

          <div className="hero-heading">
            <div>
              <h1>Register as coordinator</h1>
              <p>
                Run relief resource allocation and dispatch for the delivery
                volunteers and teams registered on the citizen app.
              </p>
            </div>
            <span className="status-pill">
              <Clock size={13} />
              Pending verification
            </span>
          </div>
        </div>
      </header>

      <main className="registration-main">
        <form className="registration-form" onSubmit={handleSubmit} noValidate>
          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <User size={17} />
              </span>
              <div>
                <h3>Your details</h3>
                <p>Your role is set by the DMC and cannot be changed here.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="fullName">Full name</label>
                <div className={wrapperClass(errors, "fullName")}>
                  <User size={17} />
                  <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setField("fullName", e.target.value)}
                    onBlur={() => blurField("fullName")}
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                </div>
                {errors.fullName && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.fullName}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="role">Role</label>
                <div className="input-wrapper locked">
                  <ShieldCheck size={17} />
                  <input
                    id="role"
                    type="text"
                    value={ROLE}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <Mail size={17} />
              </span>
              <div>
                <h3>Work contact</h3>
                <p>
                  The operations room uses these to reach you during an event.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <div className={wrapperClass(errors, "email")}>
                  <Mail size={17} />
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setField("email", e.target.value)}
                    onBlur={() => blurField("email")}
                    placeholder="name@dmc.gov.lk"
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="contactNumber">Contact number</label>
                <div className={wrapperClass(errors, "contactNumber")}>
                  <Phone size={17} />
                  <input
                    id="contactNumber"
                    type="tel"
                    value={formData.contactNumber}
                    onChange={(e) => setField("contactNumber", e.target.value)}
                    onBlur={() => blurField("contactNumber")}
                    placeholder="07X XXX XXXX"
                    autoComplete="tel"
                  />
                </div>
                {errors.contactNumber && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.contactNumber}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <LockKeyhole size={17} />
              </span>
              <div>
                <h3>Account setup</h3>
                <p>You will sign in with these credentials.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="username">Username</label>
                <div className={wrapperClass(errors, "username")}>
                  <UserCircle size={17} />
                  <input
                    id="username"
                    type="text"
                    value={formData.username}
                    onChange={(e) => setField("username", e.target.value)}
                    onBlur={() => blurField("username")}
                    placeholder="3-20 letters, numbers, . _ -"
                    autoComplete="username"
                  />
                </div>
                {errors.username && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.username}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="password">Password</label>
                <div className={wrapperClass(errors, "password")}>
                  <LockKeyhole size={17} />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setField("password", e.target.value)}
                    onBlur={() => blurField("password")}
                    placeholder="Uppercase, lowercase, number"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.password}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className={wrapperClass(errors, "confirmPassword")}>
                  <LockKeyhole size={17} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setField("confirmPassword", e.target.value)
                    }
                    onBlur={() => blurField("confirmPassword")}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.confirmPassword}
                  </span>
                )}
              </div>
            </div>
          </section>

          {submitError && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          {errorCount > 0 && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>
                {errorCount === 1
                  ? "1 field needs your attention before you continue."
                  : `${errorCount} fields need your attention before you continue.`}
              </span>
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Creating account..."
                : "Create coordinator account"}
              {!isSubmitting && (
                <ArrowLeft
                  size={17}
                  style={{ transform: "rotate(180deg)" }}
                />
              )}
            </button>
          </div>
        </form>

        <div className="registration-notice">
          <Clock size={18} />
          <div>
            <strong>Pending verification</strong>
            <span>
              A Super Admin confirms your DMC assignment before the account is
              activated. Once signed in you can filter delivery volunteers and
              teams by district, check their vehicle type and capacity, then
              allocate and track relief deliveries.
            </span>
          </div>
        </div>
      </main>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .coordinator-registration-page {
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

          .form-field label {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13.5px;
            font-weight: 700;
            color: ${Colors.navy};
            margin-bottom: 9px;
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

          .input-wrapper > svg {
            flex-shrink: 0;
            margin-left: 15px;
            color: ${Colors.muted};
          }

          .input-wrapper input,
          .input-wrapper select {
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

          .input-wrapper input[readonly] {
            color: ${Colors.muted};
            cursor: default;
          }

          .input-wrapper input::placeholder {
            color: #98a2b3;
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
        `}
      </style>
    </div>
  );
}
