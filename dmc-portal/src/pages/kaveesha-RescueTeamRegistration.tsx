import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Ambulance,
  BadgeCheck,
  Building2,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
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
  TextField,
} from "../components/dushani-RegistrationFields";
import {
  AffiliationToggle,
  CapabilityField,
  EquipmentField,
  LocationPickerField,
  RESCUE_TEAM_FIELDS_CSS,
  VerifiedOrganizationField,
} from "../components/kaveesha-RescueTeamFields";
import {
  latitudeRule,
  listRule,
  longitudeRule,
  nicRule,
  oneOfRule,
  optionalListRule,
  TEAM_CAPABILITIES,
  TEAM_EQUIPMENT,
  TEAM_TYPES,
  type VerifiedOrganization,
} from "../constants/kaveesha-rescueTeamOptions";
import { Colors } from "../constants/theme";
import { DISTRICTS } from "../constants/districts";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import { fetchVerifiedOrganizations } from "../services/kaveesha-rescueTeamApi";
import {
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  positiveInteger as positiveIntegerRule,
  required as requiredRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface RescueTeamRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const LEADER_RULES: Record<string, Validator> = {
  leaderFullName: requiredRule("Team leader full name"),
  nicNumber: nicRule,
  contactNumber: phoneRule,
  email: emailRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

const TEAM_RULES: Record<string, Validator> = {
  teamName: requiredRule("Team name"),
  teamType: oneOfRule("Team type", TEAM_TYPES),
  teamSize: positiveIntegerRule("Team size"),
  district: requiredRule("District"),
  teamContactNumber: phoneRule,
  capabilities: listRule("Capabilities", TEAM_CAPABILITIES, 1),
  equipment: optionalListRule("Equipment", TEAM_EQUIPMENT),
  baseLatitude: latitudeRule,
  baseLongitude: longitudeRule,
  baseLocationLabel: optionalRule("Location name"),
};

const AFFILIATION_RULE: Record<string, Validator> = {
  affiliation: (value) =>
    String(value ?? "") === ""
      ? "Choose a team affiliation before you continue."
      : null,
};

const ORGANIZATION_RULES: Record<string, Validator> = {
  organizationRegistrationNumber: requiredRule("Organization", 3),
  leaderDesignation: requiredRule("Designation"),
};

const INITIAL_VALUES = {
  affiliation: "",
  leaderFullName: "",
  nicNumber: "",
  leaderDesignation: "",
  contactNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
  organizationName: "",
  organizationRegistrationNumber: "",
  teamName: "",
  teamType: "",
  teamSize: "",
  district: "",
  teamContactNumber: "",
  capabilities: "",
  equipment: "",
  baseLatitude: "",
  baseLongitude: "",
  baseLocationLabel: "",
};

function buildRules(affiliation: string): Record<string, Validator> {
  if (affiliation === "ORGANIZATION") {
    return {
      ...AFFILIATION_RULE,
      ...LEADER_RULES,
      ...ORGANIZATION_RULES,
      ...TEAM_RULES,
    };
  }

  if (affiliation === "INDEPENDENT") {
    return { ...AFFILIATION_RULE, ...LEADER_RULES, ...TEAM_RULES };
  }

  return { ...AFFILIATION_RULE };
}

function StepStrip({ affiliation }: { affiliation: string }) {
  const reviewer =
    affiliation === "INDEPENDENT"
      ? "Super Admin review"
      : "Organization Admin review";

  const steps = [
    { label: "Submit", body: "Leader, organization and team details" },
    { label: reviewer, body: "Status becomes PENDING until the review ends" },
    {
      label: "Verified team",
      body: "Sign in here and on the mobile app for tasking",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginTop: "26px",
      }}
    >
      {steps.map((step, index) => (
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

export default function RescueTeamRegistration({
  onBack,
  onSuccess,
}: RescueTeamRegistrationProps) {
  const [organizations, setOrganizations] = useState<VerifiedOrganization[]>(
    []
  );
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationsError, setOrganizationsError] = useState<string | null>(
    null
  );
  const organizationsLoaded = useRef(false);

  const [affiliation, setAffiliation] = useState("");

  const loadOrganizations = useCallback(() => {
    if (organizationsLoaded.current) return;

    organizationsLoaded.current = true;
    setOrganizationsLoading(true);
    setOrganizationsError(null);

    fetchVerifiedOrganizations()
      .then((rows) => {
        setOrganizations(rows);
        setOrganizationsLoading(false);
      })
      .catch((error: Error) => {
        organizationsLoaded.current = false;
        setOrganizations([]);
        setOrganizationsError(
          error.message || "Verified organizations could not be loaded."
        );
        setOrganizationsLoading(false);
      });
  }, []);

  const {
    formData,
    errors,
    submitError,
    isSubmitting,
    setField,
    blurField,
    submit,
  } = useRegistrationForm({
    initialValues: INITIAL_VALUES,
    rules: buildRules(affiliation),
    onSubmit: (values) => {
      const underOrganization = values.affiliation === "ORGANIZATION";
      const payload: Record<string, string> = { ...values };

      // An independent team must not carry a stale organization or the review
      // would be routed to an organization admin.
      if (!underOrganization) {
        delete payload.organizationName;
        delete payload.organizationRegistrationNumber;
        delete payload.leaderDesignation;
      }

      return registerAccount(
        underOrganization ? "rescue-team-organization" : "rescue-team-independent",
        payload
      );
    },
  });

  const isOrganization = affiliation === "ORGANIZATION";

  const handleAffiliation = (value: string) => {
    setAffiliation(value);
    setField("affiliation", value);

    if (value === "ORGANIZATION") {
      loadOrganizations();
      return;
    }

    setField("organizationName", "");
    setField("organizationRegistrationNumber", "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  return (
    <RegistrationShell
      title="Rescue team registration"
      subtitle="Register the team you lead. Organization teams are verified by that organization's admin, independent and community teams by a DMC Super Admin."
      eyebrow="RESCUE TEAM REGISTRATION"
      icon={Siren}
      onBack={onBack}
      statusPill={
        formData.affiliation
          ? isOrganization
            ? "Pending organization admin verification"
            : "Pending Super Admin verification"
          : "Choose a team affiliation to begin"
      }
      headerExtra={<StepStrip affiliation={formData.affiliation} />}
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormSection
          icon={ShieldCheck}
          title="Team affiliation"
          caption="This one choice decides the rest of the form and who reviews your team."
        >
          <AffiliationToggle
            value={formData.affiliation}
            onChange={handleAffiliation}
            error={errors.affiliation}
          />
        </FormSection>

        {!formData.affiliation && (
          <Notice
            title="Select how your team is set up"
            body="Choose Organization if your team belongs to a rescue organization that is already verified on SafePlus. Choose Independent / Community for a local team with no parent organization."
            tone="info"
          />
        )}

        {formData.affiliation && (
          <>
            <FormSection
              icon={UserRound}
              title="Team leader"
              caption="The person who leads this team and signs in to the portal and the mobile app."
            >
              <TextField
                id="leaderFullName"
                label="Full name"
                value={formData.leaderFullName}
                onChange={(v) => setField("leaderFullName", v)}
                onBlur={() => blurField("leaderFullName")}
                error={errors.leaderFullName}
                placeholder="Nimal Perera"
                icon={UserRound}
                autoComplete="name"
              />
              <TextField
                id="nicNumber"
                label="NIC / official ID"
                value={formData.nicNumber}
                onChange={(v) => setField("nicNumber", v)}
                onBlur={() => blurField("nicNumber")}
                error={errors.nicNumber}
                placeholder="199012345678"
                icon={IdCard}
                inputMode="text"
                autoComplete="off"
              />
              {isOrganization && (
                <TextField
                  id="leaderDesignation"
                  label="Designation"
                  value={formData.leaderDesignation}
                  onChange={(v) => setField("leaderDesignation", v)}
                  onBlur={() => blurField("leaderDesignation")}
                  error={errors.leaderDesignation}
                  placeholder="Rescue Team Leader"
                  icon={BadgeCheck}
                  autoComplete="organization-title"
                />
              )}
              <TextField
                id="contactNumber"
                label="Phone"
                value={formData.contactNumber}
                onChange={(v) => setField("contactNumber", v)}
                onBlur={() => blurField("contactNumber")}
                error={errors.contactNumber}
                placeholder="077 123 4567"
                icon={Phone}
                type="tel"
                autoComplete="tel"
              />
              <TextField
                id="email"
                label="Email"
                value={formData.email}
                onChange={(v) => setField("email", v)}
                onBlur={() => blurField("email")}
                error={errors.email}
                placeholder="nimal@example.lk"
                icon={Mail}
                type="email"
                autoComplete="username"
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
                id="leaderAccess"
                label="Signs in to"
                value="DMC portal and the mobile app"
                icon={LockKeyhole}
              />
            </FormSection>

            {isOrganization && (
              <FormSection
                icon={Building2}
                title="Organization"
                caption="Only organizations a Super Admin has already verified can be selected here."
              >
                <VerifiedOrganizationField
                  organizations={organizations}
                  loading={organizationsLoading}
                  value={formData.organizationRegistrationNumber}
                  onPick={(organization) => {
                    setField(
                      "organizationName",
                      organization?.name ?? ""
                    );
                    setField(
                      "organizationRegistrationNumber",
                      organization?.registrationId ?? ""
                    );
                    blurField("organizationRegistrationNumber");
                  }}
                  onBlur={() => blurField("organizationRegistrationNumber")}
                  error={
                    errors.organizationRegistrationNumber ??
                    errors.organizationName
                  }
                />

                {organizationsError && (
                  <div className="error-message">
                    <AlertCircle size={18} />
                    <span>{organizationsError}</span>
                  </div>
                )}
              </FormSection>
            )}

            <FormSection
              icon={Ambulance}
              title="Team details"
              caption="What this team is called, what it does and where it stages from."
            >
              <TextField
                id="teamName"
                label="Team name"
                value={formData.teamName}
                onChange={(v) => setField("teamName", v)}
                onBlur={() => blurField("teamName")}
                error={errors.teamName}
                placeholder="Colombo Flood Rescue Team 01"
                icon={Ambulance}
                autoComplete="off"
              />
              <SelectField
                id="teamType"
                label="Team type"
                value={formData.teamType}
                onChange={(v) => setField("teamType", v)}
                onBlur={() => blurField("teamType")}
                error={errors.teamType}
                options={TEAM_TYPES}
                placeholder="Select team type"
              />
              <TextField
                id="teamSize"
                label="Team size"
                value={formData.teamSize}
                onChange={(v) => setField("teamSize", v)}
                onBlur={() => blurField("teamSize")}
                error={errors.teamSize}
                placeholder="8"
                icon={Users}
                inputMode="numeric"
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
              <TextField
                id="teamContactNumber"
                label="Team contact number"
                value={formData.teamContactNumber}
                onChange={(v) => setField("teamContactNumber", v)}
                onBlur={() => blurField("teamContactNumber")}
                error={errors.teamContactNumber}
                placeholder="077 123 4567"
                icon={PhoneCall}
                type="tel"
                autoComplete="tel"
              />

              <CapabilityField
                value={formData.capabilities}
                onChange={(next) => setField("capabilities", next)}
                onBlur={() => blurField("capabilities")}
                error={errors.capabilities}
              />

              <EquipmentField
                value={formData.equipment}
                onChange={(next) => setField("equipment", next)}
                onBlur={() => blurField("equipment")}
                error={errors.equipment}
              />

              <LocationPickerField
                latitude={formData.baseLatitude}
                longitude={formData.baseLongitude}
                district={formData.district}
                onPick={(point) => {
                  setField("baseLatitude", point.baseLatitude);
                  setField("baseLongitude", point.baseLongitude);
                }}
                error={errors.baseLatitude ?? errors.baseLongitude}
              />

              <TextField
                id="baseLocationLabel"
                label="Location name"
                value={formData.baseLocationLabel}
                onChange={(v) => setField("baseLocationLabel", v)}
                onBlur={() => blurField("baseLocationLabel")}
                error={errors.baseLocationLabel}
                placeholder="Kelaniya boat bay, Colombo 15"
                icon={MapPin}
                optional
                autoComplete="off"
              />
            </FormSection>

            <FormMessages submitError={submitError} errors={errors} />

            <SubmitButton
              label={isSubmitting ? "Submitting..." : "Register team"}
              disabled={isSubmitting}
            />
          </>
        )}
      </form>

      {formData.affiliation && (
        <>
          <Notice
            title="Sent for verification"
            body={
              isOrganization
                ? `Your team is created as PENDING and goes to the ${
                    formData.organizationName || "organization"
                  } admin. They approve or reject it, and a rejection comes back to you with the reason so you can correct and resubmit.`
                : "Your team is created as PENDING and goes to a DMC Super Admin. Once approved the team becomes eligible for operations."
            }
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
              You sign in with this email and password on the DMC portal and on
              the SafePlus mobile app. Team leaders are the only users who need
              both, because they carry GPS and status tracking into the field.
            </span>
          </div>
        </>
      )}

      <style>{RESCUE_TEAM_FIELDS_CSS}</style>
    </RegistrationShell>
  );
}
