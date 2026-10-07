import type { FormEvent } from "react";
import {
  Building2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
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
import { DISTRICTS } from "../constants/districts";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  address as addressRule,
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  positiveInteger,
  required as requiredRule,
  username as usernameRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface OrganizationAdminRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ORGANIZATION_TYPES = [
  "Rescue Organization",
  "Volunteer Group",
  "NGO",
  "Military Unit",
  "Other",
];

const RULES: Record<string, Validator> = {
  organizationName: requiredRule("Organization name"),
  organizationType: requiredRule("Organization type"),
  registrationNumber: requiredRule("Registration number"),
  contactPerson: requiredRule("Contact person"),
  contactNumber: phoneRule,
  email: emailRule,
  organizationAddress: addressRule,
  district: requiredRule("District"),
  operatingArea: optionalRule("Operating area"),
  numberOfRescueTeams: positiveInteger("Number of rescue teams"),
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

export default function OrganizationAdminRegistration({
  onBack,
  onSuccess,
}: OrganizationAdminRegistrationProps) {
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
      contactPerson: "",
      contactNumber: "",
      email: "",
      organizationAddress: "",
      district: "",
      operatingArea: "",
      numberOfRescueTeams: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("organization-admin", values),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  return (
    <RegistrationShell
      title="Register your rescue organization"
      subtitle="Organizations that field rescue teams. Your admin account approves or rejects the teams that belong to it."
      eyebrow="ORGANIZATION REGISTRATION"
      icon={Building2}
      onBack={onBack}
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormSection
          icon={Building2}
          title="Organization"
          caption="A Super Admin checks this against the official registration number."
        >
          <TextField
            id="organizationName"
            label="Organization name"
            value={formData.organizationName}
            onChange={(v) => setField("organizationName", v)}
            onBlur={() => blurField("organizationName")}
            error={errors.organizationName}
            placeholder="Enter organization name"
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
            label="Registration number"
            value={formData.registrationNumber}
            onChange={(v) => setField("registrationNumber", v)}
            onBlur={() => blurField("registrationNumber")}
            error={errors.registrationNumber}
            placeholder="e.g., RO-2021-114"
            icon={ShieldCheck}
            autoComplete="off"
          />
        </FormSection>

        <FormSection
          icon={Phone}
          title="Primary contact"
          caption="The person the DMC operations room calls first."
        >
          <TextField
            id="contactPerson"
            label="Contact person"
            value={formData.contactPerson}
            onChange={(v) => setField("contactPerson", v)}
            onBlur={() => blurField("contactPerson")}
            error={errors.contactPerson}
            placeholder="Enter contact person name"
            icon={ShieldCheck}
            autoComplete="name"
          />
          <TextField
            id="contactNumber"
            label="Contact number"
            value={formData.contactNumber}
            onChange={(v) => setField("contactNumber", v)}
            onBlur={() => blurField("contactNumber")}
            error={errors.contactNumber}
            placeholder="07X XXX XXXX"
            icon={Phone}
            type="tel"
            autoComplete="tel"
          />
          <TextField
            id="email"
            label="Official email"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="name@organization.lk"
            icon={Mail}
            type="email"
            autoComplete="email"
          />
        </FormSection>

        <FormSection
          icon={MapPin}
          title="Where you operate"
          caption="Teams you register inherit this base unless they report another area."
        >
          <TextField
            id="organizationAddress"
            label="Organization address"
            value={formData.organizationAddress}
            onChange={(v) => setField("organizationAddress", v)}
            onBlur={() => blurField("organizationAddress")}
            error={errors.organizationAddress}
            placeholder="No. 123, Main Street"
            icon={MapPin}
            autoComplete="street-address"
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
            id="operatingArea"
            label="Operating area"
            value={formData.operatingArea}
            onChange={(v) => setField("operatingArea", v)}
            onBlur={() => blurField("operatingArea")}
            error={errors.operatingArea}
            placeholder="e.g., Western Province"
            icon={MapPin}
            optional
          />
          <TextField
            id="numberOfRescueTeams"
            label="Number of rescue teams"
            value={formData.numberOfRescueTeams}
            onChange={(v) => setField("numberOfRescueTeams", v)}
            onBlur={() => blurField("numberOfRescueTeams")}
            error={errors.numberOfRescueTeams}
            placeholder="e.g. 5"
            icon={Users}
            inputMode="numeric"
          />
          <LockedField
            id="interface"
            label="Signs in to"
            value="DMC portal only"
            icon={ShieldCheck}
          />
        </FormSection>

        <FormSection
          icon={LockKeyhole}
          title="Account setup"
          caption="You will sign in with these credentials."
        >
          <TextField
            id="username"
            label="Username"
            value={formData.username}
            onChange={(v) => setField("username", v)}
            onBlur={() => blurField("username")}
            error={errors.username}
            placeholder="3-20 letters, numbers, . _ -"
            icon={ShieldCheck}
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
        </FormSection>

        <FormMessages submitError={submitError} errors={errors} />

        <SubmitButton
          label={isSubmitting ? "Submitting..." : "Submit for verification"}
          disabled={isSubmitting}
        />
      </form>

      <Notice
        title="Verified before access"
        body="A Super Admin verifies your registration number. Once approved you can sign in to the portal to approve or reject the rescue teams registered under your organization."
      />
    </RegistrationShell>
  );
}
