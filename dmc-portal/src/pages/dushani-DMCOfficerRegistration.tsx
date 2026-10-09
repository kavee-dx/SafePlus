import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
  User,
  IdCard,
  BadgeCheck,
  Clock,
  AlertCircle,
} from "lucide-react";

import { Colors } from "../constants/theme";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  type FieldErrors,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface DmcOfficerRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const RULES: Record<string, Validator> = {
  fullName: requiredRule("Full name"),
  officerId: requiredRule("Officer ID"),
  designation: requiredRule("Designation"),
  officialEmail: emailRule,
  phoneNumber: phoneRule,
  dmcOffice: requiredRule("DMC office"),
  district: requiredRule("District"),
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
  clearanceInfo: optionalRule("Clearance information"),
};

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

const DESIGNATIONS = [
  "DMC Duty Officer",
  "Assistant Director",
  "Senior Officer",
  "Field Officer",
];

function wrapperClass(errors: FieldErrors, field: string): string {
  return errors[field] ? "input-wrapper invalid" : "input-wrapper";
}

export default function DmcOfficerRegistration({
  onBack,
  onSuccess,
}: DmcOfficerRegistrationProps) {
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
      officerId: "",
      officialEmail: "",
      phoneNumber: "",
      dmcOffice: "",
      district: "",
      designation: "",
      password: "",
      confirmPassword: "",
      clearanceInfo: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("dmc-officer", values),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="dmc-officer-registration-page">
      <header className="registration-hero">
        <div className="registration-hero-inner">
          <div className="hero-top">
            <button className="back-button" onClick={onBack}>
              <ArrowLeft size={18} />
              Back
            </button>

            <div className="brand">
              <div className="brand-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="brand-name">
                  Safe<span>Plus</span>
                </div>
                <div className="brand-subtitle">DMC OFFICER REGISTRATION</div>
              </div>
            </div>
          </div>

          <div className="hero-heading">
            <div>
              <h1>Register as DMC Officer</h1>
              <p>
                Complete the sections below. A Super Admin reviews and verifies
                your details before the account is activated.
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
        <form
          className="registration-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <User size={17} />
              </span>
              <div>
                <h3>Officer details</h3>
                <p>How you are identified within the Disaster Management Centre.</p>
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
                <label htmlFor="officerId">Officer ID</label>
                <div className={wrapperClass(errors, "officerId")}>
                  <IdCard size={17} />
                  <input
                    id="officerId"
                    type="text"
                    value={formData.officerId}
                    onChange={(e) => setField("officerId", e.target.value)}
                    onBlur={() => blurField("officerId")}
                    placeholder="DMC-XXXXX"
                    autoComplete="off"
                  />
                </div>
                {errors.officerId && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.officerId}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="designation">Designation</label>
                <div className={wrapperClass(errors, "designation")}>
                  <BadgeCheck size={17} />
                  <select
                    id="designation"
                    value={formData.designation}
                    onChange={(e) => setField("designation", e.target.value)}
                    onBlur={() => blurField("designation")}
                  >
                    <option value="">Select designation</option>
                    {DESIGNATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.designation && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.designation}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <Mail size={17} />
              </span>
              <div>
                <h3>Contact information</h3>
                <p>Used for incident alerts and admin communication.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="officialEmail">Official email</label>
                <div className={wrapperClass(errors, "officialEmail")}>
                  <Mail size={17} />
                  <input
                    id="officialEmail"
                    type="email"
                    value={formData.officialEmail}
                    onChange={(e) => setField("officialEmail", e.target.value)}
                    onBlur={() => blurField("officialEmail")}
                    placeholder="officer@dmc.gov.lk"
                    autoComplete="email"
                  />
                </div>
                {errors.officialEmail && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.officialEmail}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="phoneNumber">Phone number</label>
                <div className={wrapperClass(errors, "phoneNumber")}>
                  <Phone size={17} />
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setField("phoneNumber", e.target.value)}
                    onBlur={() => blurField("phoneNumber")}
                    placeholder="07X XXX XXXX"
                    autoComplete="tel"
                  />
                </div>
                {errors.phoneNumber && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">
              <span className="section-icon">
                <Building2 size={17} />
              </span>
              <div>
                <h3>Office and district</h3>
                <p>Sets which relief operations you can manage.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="dmcOffice">DMC office</label>
                <div className={wrapperClass(errors, "dmcOffice")}>
                  <Building2 size={17} />
                  <input
                    id="dmcOffice"
                    type="text"
                    value={formData.dmcOffice}
                    onChange={(e) => setField("dmcOffice", e.target.value)}
                    onBlur={() => blurField("dmcOffice")}
                    placeholder="e.g., Colombo DMC Office"
                    autoComplete="organization"
                  />
                </div>
                {errors.dmcOffice && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.dmcOffice}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="district">District</label>
                <div className={wrapperClass(errors, "district")}>
                  <MapPin size={17} />
                  <select
                    id="district"
                    value={formData.district}
                    onChange={(e) => setField("district", e.target.value)}
                    onBlur={() => blurField("district")}
                  >
                    <option value="">Select district</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.district && (
                  <span className="field-error">
                    <AlertCircle size={12} />
                    {errors.district}
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
                <p>Choose a strong password for portal access.</p>
              </div>
            </div>

            <div className="form-grid">
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
                    onChange={(e) => setField("confirmPassword", e.target.value)}
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

            <div className="form-field field-full">
              <label htmlFor="clearanceInfo">
                Clearance / authorisation information
                <span className="optional-tag">Optional</span>
              </label>
              <div className={wrapperClass(errors, "clearanceInfo")}>
                <ShieldCheck size={17} />
                <input
                  id="clearanceInfo"
                  type="text"
                  value={formData.clearanceInfo}
                  onChange={(e) => setField("clearanceInfo", e.target.value)}
                  onBlur={() => blurField("clearanceInfo")}
                  placeholder="Enter clearance details if applicable"
                  autoComplete="off"
                />
              </div>
              {errors.clearanceInfo && (
                <span className="field-error">
                  <AlertCircle size={12} />
                  {errors.clearanceInfo}
                </span>
              )}
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
              {isSubmitting ? "Submitting..." : "Submit registration"}
              {!isSubmitting && <ArrowLeft size={17} style={{ transform: "rotate(180deg)" }} />}
            </button>
          </div>
        </form>

        <div className="registration-notice">
          <Clock size={18} />
          <div>
            <strong>Pending verification</strong>
            <span>
              Your registration is reviewed by a Super Admin. You will be
              notified by email once the account is approved.
            </span>
          </div>
        </div>
      </main>

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .dmc-officer-registration-page {
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

          .input-wrapper select {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
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
