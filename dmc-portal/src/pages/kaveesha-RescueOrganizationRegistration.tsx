import type { FormEvent } from "react";
import {
  BadgeCheck,
  Building2,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  FormMessages,
  FormSection,
  LockedField,
  Notice,
  PasswordField,
  RegistrationShell,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../components/dushani-RegistrationFields";
import { Colors } from "../constants/theme";
import { DISTRICTS } from "../constants/districts";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface RescueOrganizationRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ORGANIZATION_TYPES = [
  "Government Agency",
  "Armed Forces",
  "Police / Emergency Service",
  "Fire & Rescue",
  "NGO",
  "Community Organization",
  "Private Emergency Service",
  "Other",
] as const;

function oneOf(label: string, allowed: readonly string[]): Validator {
  return (value) => {
    const v = String(value ?? "").trim();
    if (!v) return `${label} is required.`;
    if (!allowed.includes(v)) return `${label} is not a supported option.`;
    return null;
  };
}

const RULES: Record<string, Validator> = {
  organizationName: requiredRule("Organization name"),
  organizationType: oneOf("Organization type", ORGANIZATION_TYPES),
  registrationNumber: requiredRule("Organization / registration ID", 3),
  district: requiredRule("District"),
  organizationAddress: requiredRule("Address", 5),
  officialEmail: emailRule,
  officialPhone: phoneRule,
  adminFullName: requiredRule("Full name"),
  adminDesignation: requiredRule("Designation"),
  adminEmail: emailRule,
  adminPhone: phoneRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

const REVIEW_STEPS = [
  { label: "Submit", body: "Organization and admin details" },
  { label: "Super Admin review", body: "Registration ID is verified" },
  { label: "Dashboard", body: "Manage the teams under your organization" },
];

function StepStrip() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginTop: "26px",
      }}
    >
      {REVIEW_STEPS.map((step, index) => (
        <div
          key={step.label}
          style={{
            padding: "14px 16px",
            borderRadius: "14px",
            background: "rgba(255, 255, 255, 0.07)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: Colors.white,
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "7px",
                background: index === 2 ? Colors.success : Colors.blue,
                color: Colors.white,
                fontSize: "11px",
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {index + 1}
            </span>
            {step.label}
          </div>
          <div
            style={{
              marginTop: "6px",
              color: Colors.blueLight,
              fontSize: "12px",
              lineHeight: 1.55,
            }}
          >
            {step.body}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RescueOrganizationRegistration({
  onBack,
  onSuccess,
}: RescueOrganizationRegistrationProps) {
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
      organizationName: "",
      organizationType: "",
      registrationNumber: "",
      district: "",
      organizationAddress: "",
      officialEmail: "",
      officialPhone: "",
      adminFullName: "",
      adminDesignation: "",
      adminEmail: "",
      adminPhone: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("rescue-organization", values),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  return (
    <RegistrationShell
      title="Rescue organization registration"
      subtitle="For an authorized representative of a rescue organization. The account is opened for portal access once a Super Admin verifies the organization."
      eyebrow="RESCUE ORGANIZATION REGISTRATION"
      icon={Building2}
      onBack={onBack}
      statusPill="Pending Super Admin verification"
      headerExtra={<StepStrip />}
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormSection
          icon={Building2}
          title="Organization details"
          caption="Every field here is checked against the official registration records."
        >
          <TextField
            id="organizationName"
            label="Organization name"
            value={formData.organizationName}
            onChange={(v) => setField("organizationName", v)}
            onBlur={() => blurField("organizationName")}
            error={errors.organizationName}
            placeholder="Sri Lanka Army"
            icon={Building2}
            autoComplete="organization"
          />
          <SelectField
            id="organizationType"
            label="Organization type"
            value={formData.organizationType}
            onChange={(v) => setField("organizationType", v)}
            onBlur={() => blurField("organizationType")}
            error={errors.organizationType}
            options={ORGANIZATION_TYPES}
            placeholder="Select organization type"
          />
          <TextField
            id="registrationNumber"
            label="Organization / registration ID"
            value={formData.registrationNumber}
            onChange={(v) => setField("registrationNumber", v)}
            onBlur={() => blurField("registrationNumber")}
            error={errors.registrationNumber}
            placeholder="SLA-001"
            icon={IdCard}
            autoComplete="off"
          />
          <SelectField
            id="district"
            label="District"
            value={formData.district}
            onChange={(v) => setField("district", v)}
            onBlur={() => blurField("district")}
            error={errors.district}
            options={DISTRICTS}
            placeholder="Select district"
          />
          <TextAreaField
            id="organizationAddress"
            label="Address"
            value={formData.organizationAddress}
            onChange={(v) => setField("organizationAddress", v)}
            onBlur={() => blurField("organizationAddress")}
            error={errors.organizationAddress}
            placeholder="Army Headquarters, Colombo"
            full
          />
          <TextField
            id="officialEmail"
            label="Official email"
            value={formData.officialEmail}
            onChange={(v) => setField("officialEmail", v)}
            onBlur={() => blurField("officialEmail")}
            error={errors.officialEmail}
            placeholder="info@example.lk"
            icon={Mail}
            type="email"
            autoComplete="email"
          />
          <TextField
            id="officialPhone"
            label="Official phone"
            value={formData.officialPhone}
            onChange={(v) => setField("officialPhone", v)}
            onBlur={() => blurField("officialPhone")}
            error={errors.officialPhone}
            placeholder="011 234 5678"
            icon={Phone}
            type="tel"
            autoComplete="tel"
          />
        </FormSection>

        <FormSection
          icon={UserRound}
          title="Organization admin"
          caption="The representative who signs in to the portal and manages this organization's teams."
        >
          <TextField
            id="adminFullName"
            label="Full name"
            value={formData.adminFullName}
            onChange={(v) => setField("adminFullName", v)}
            onBlur={() => blurField("adminFullName")}
            error={errors.adminFullName}
            placeholder="Kamal Perera"
            icon={UserRound}
            autoComplete="name"
          />
          <TextField
            id="adminDesignation"
            label="Designation"
            value={formData.adminDesignation}
            onChange={(v) => setField("adminDesignation", v)}
            onBlur={() => blurField("adminDesignation")}
            error={errors.adminDesignation}
            placeholder="Operations Officer"
            icon={BadgeCheck}
            autoComplete="organization-title"
          />
          <TextField
            id="adminEmail"
            label="Email"
            value={formData.adminEmail}
            onChange={(v) => setField("adminEmail", v)}
            onBlur={() => blurField("adminEmail")}
            error={errors.adminEmail}
            placeholder="kamal@example.lk"
            icon={Mail}
            type="email"
            autoComplete="username"
          />
          <TextField
            id="adminPhone"
            label="Phone"
            value={formData.adminPhone}
            onChange={(v) => setField("adminPhone", v)}
            onBlur={() => blurField("adminPhone")}
            error={errors.adminPhone}
            placeholder="077 123 4567"
            icon={Phone}
            type="tel"
            autoComplete="tel"
          />
          <PasswordField
            id="password"
            label="Password"
            value={formData.password}
            onChange={(v) => setField("password", v)}
            onBlur={() => blurField("password")}
            error={errors.password}
            placeholder="Uppercase, lowercase, number"
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={formData.confirmPassword}
            onChange={(v) => setField("confirmPassword", v)}
            onBlur={() => blurField("confirmPassword")}
            error={errors.confirmPassword}
            placeholder="Re-enter password"
          />
          <LockedField
            id="interface"
            label="Signs in to"
            value="DMC portal only"
            icon={LockKeyhole}
          />
        </FormSection>

        <FormMessages submitError={submitError} errors={errors} />

        <SubmitButton
          label={isSubmitting ? "Submitting..." : "Register organization"}
          disabled={isSubmitting}
        />
      </form>

      <Notice
        title="Verified before access"
        body="Your organization is set to PENDING straight away. A Super Admin reviews it and, on approval, the organization becomes VERIFIED, the admin account becomes ACTIVE, and the dashboard opens. Sign-in is blocked until then."
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "14px",
          padding: "16px 18px",
          borderRadius: "16px",
          background: Colors.blueLight,
          border: `1px solid ${Colors.blue}`,
          color: Colors.muted,
          fontSize: "12px",
          lineHeight: 1.6,
        }}
      >
        <ShieldCheck size={17} style={{ color: Colors.blue, flexShrink: 0 }} />
        <span>
          Sign in later with the organization admin email and password. Teams
          that report your registration ID appear on your dashboard.
        </span>
      </div>
    </RegistrationShell>
  );
}
