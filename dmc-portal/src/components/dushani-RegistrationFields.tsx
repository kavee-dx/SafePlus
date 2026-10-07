import { useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import { REGISTRATION_FORM_CSS } from "../styles/dushani-registrationFormStyles";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

type IconProp = LucideIcon;

export function RegistrationShell({
  title,
  subtitle,
  eyebrow,
  icon: BrandIcon,
  onBack,
  statusPill,
  headerExtra,
  children,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  icon: IconProp;
  onBack: () => void;
  statusPill?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="registration-page">
      <header className="registration-hero">
        <div className="registration-hero-inner">
          <div className="hero-top">
            <button className="back-button" onClick={onBack}>
              <ArrowLeft size={18} />
              Back
            </button>

            <div className="brand">
              <div className="brand-icon">
                <BrandIcon size={20} />
              </div>
              <div>
                <div className="brand-name">
                  Safe<span>Plus</span>
                </div>
                <div className="brand-subtitle">{eyebrow}</div>
              </div>
            </div>
          </div>

          <div className="hero-heading">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {statusPill && (
              <span className="status-pill">
                <AlertCircle size={13} />
                {statusPill}
              </span>
            )}
          </div>

          {headerExtra}
        </div>
      </header>

      <main className="registration-main">{children}</main>

      <style>{REGISTRATION_FORM_CSS}</style>
    </div>
  );
}

export function FormSection({
  icon: SectionIcon,
  title,
  caption,
  children,
}: {
  icon: IconProp;
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="section-title">
        <span className="section-icon">
          <SectionIcon size={17} />
        </span>
        <div>
          <h3>{title}</h3>
          {caption && <p>{caption}</p>}
        </div>
      </div>
      <div className="form-grid">{children}</div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  placeholder?: string;
  icon: IconProp;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  full?: boolean;
}

function wrapperClass(error?: string): string {
  return error ? "input-wrapper invalid" : "input-wrapper";
}

function FieldLabel({
  htmlFor,
  label,
  optional,
}: {
  htmlFor: string;
  label: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor}>
      {label}
      {optional && <span className="optional-tag">Optional</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <span className="field-error">
      <AlertCircle size={12} />
      {message}
    </span>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  icon: FieldIcon,
  optional,
  type = "text",
  autoComplete,
  inputMode,
  full,
}: FieldProps) {
  return (
    <div className={full ? "form-field field-full" : "form-field"}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <div className={wrapperClass(error)}>
        <FieldIcon size={17} />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  options,
  placeholder = "Select an option",
  full,
}: Omit<FieldProps, "icon" | "placeholder" | "type"> & {
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <div className={full ? "form-field field-full" : "form-field"}>
      <FieldLabel htmlFor={id} label={label} />
      <div className={wrapperClass(error)}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  optional,
  full,
}: Omit<FieldProps, "icon">) {
  return (
    <div className={full ? "form-field field-full" : "form-field"}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <div className={wrapperClass(error)}>
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  autoComplete = "new-password",
}: Omit<FieldProps, "icon" | "optional" | "type" | "inputMode" | "full">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-field">
      <FieldLabel htmlFor={id} label={label} />
      <div className={wrapperClass(error)}>
        <Eye size={17} />
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function LockedField({
  id,
  label,
  value,
  icon: FieldIcon,
}: Pick<FieldProps, "id" | "label" | "value" | "icon">) {
  return (
    <div className="form-field">
      <FieldLabel htmlFor={id} label={label} />
      <div className="input-wrapper locked">
        <FieldIcon size={17} />
        <input id={id} type="text" value={value} readOnly aria-readonly="true" />
      </div>
    </div>
  );
}

export function FormMessages({
  submitError,
  errors,
}: {
  submitError: string | null;
  errors: FieldErrors;
}) {
  const count = Object.keys(errors).length;

  return (
    <>
      {submitError && (
        <div className="error-message">
          <AlertCircle size={18} />
          <span>{submitError}</span>
        </div>
      )}

      {count > 0 && (
        <div className="error-message">
          <AlertCircle size={18} />
          <span>
            {count === 1
              ? "1 field needs your attention before you continue."
              : `${count} fields need your attention before you continue.`}
          </span>
        </div>
      )}
    </>
  );
}

export function SubmitButton({
  label,
  disabled,
}: {
  label: string;
  disabled: boolean;
}) {
  return (
    <div className="form-actions">
      <button type="submit" className="submit-button" disabled={disabled}>
        {label}
        {!disabled && (
          <ArrowLeft size={17} style={{ transform: "rotate(180deg)" }} />
        )}
      </button>
    </div>
  );
}

export function Notice({
  title,
  body,
  tone = "pending",
}: {
  title: string;
  body: string;
  tone?: "pending" | "info";
}) {
  return (
    <div
      className="registration-notice"
      style={
        tone === "info"
          ? { background: Colors.blueLight, borderColor: Colors.blue }
          : undefined
      }
    >
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}
