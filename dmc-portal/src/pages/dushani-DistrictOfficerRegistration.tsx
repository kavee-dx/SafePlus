import type { FormEvent } from "react";
import {
  BadgeCheck,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  User,
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
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface DistrictOfficerRegistrationProps {
  onBack: () => void;
  onSuccess: () => void;
}

const CLEARANCE_LEVELS = [
  "Field Operations",
  "Resource and Logistics",
  "Full District Authority",
];

const RULES: Record<string, Validator> = {
  fullName: requiredRule("Full name"),
  officerId: requiredRule("Officer ID", 4),
  officialEmail: emailRule,
  dutyPhoneNumber: phoneRule,
  assignedDistrict: requiredRule("Assigned district"),
  divisionalSecretariats: optionalRule("Divisional secretariats"),
  clearanceLevel: requiredRule("Clearance level"),
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

export default function DistrictOfficerRegistration({
  onBack,
  onSuccess,
}: DistrictOfficerRegistrationProps) {
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
      dutyPhoneNumber: "",
      assignedDistrict: "",
      divisionalSecretariats: "",
      clearanceLevel: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("district-officer", values),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (await submit()) onSuccess();
  };

  return (
    <RegistrationShell
      title="Register as district officer"
      subtitle="District Disaster Management Officers review incidents, dispatch rescue teams and track them on the map."
      eyebrow="DISTRICT OFFICER REGISTRATION"
      icon={MapPin}
      onBack={onBack}
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormSection
          icon={User}
          title="Officer details"
          caption="How you are identified within the District Disaster Management Office."
        >
          <TextField
            id="fullName"
            label="Full name"
            value={formData.fullName}
            onChange={(v) => setField("fullName", v)}
            onBlur={() => blurField("fullName")}
            error={errors.fullName}
            placeholder="Enter your full name"
            icon={User}
            autoComplete="name"
          />
          <TextField
            id="officerId"
            label="Officer ID"
            value={formData.officerId}
            onChange={(v) => setField("officerId", v)}
            onBlur={() => blurField("officerId")}
            error={errors.officerId}
            placeholder="DMC-XXXXX"
            icon={IdCard}
            autoComplete="off"
          />
          <TextField
            id="officialEmail"
            label="Official email"
            value={formData.officialEmail}
            onChange={(v) => setField("officialEmail", v)}
            onBlur={() => blurField("officialEmail")}
            error={errors.officialEmail}
            placeholder="officer@dmc.gov.lk"
            icon={Mail}
            type="email"
            autoComplete="email"
          />
          <TextField
            id="dutyPhoneNumber"
            label="Duty phone number"
            value={formData.dutyPhoneNumber}
            onChange={(v) => setField("dutyPhoneNumber", v)}
            onBlur={() => blurField("dutyPhoneNumber")}
            error={errors.dutyPhoneNumber}
            placeholder="07X XXX XXXX"
            icon={Phone}
            type="tel"
            autoComplete="tel"
          />
        </FormSection>

        <FormSection
          icon={MapPin}
          title="District assignment"
          caption="Sets which incidents and rescue teams appear on your dashboard."
        >
          <SelectField
            id="assignedDistrict"
            label="Assigned district"
            value={formData.assignedDistrict}
            onChange={(v) => setField("assignedDistrict", v)}
            onBlur={() => blurField("assignedDistrict")}
            error={errors.assignedDistrict}
            options={DISTRICTS}
            placeholder="Select district"
          />
          <TextField
            id="divisionalSecretariats"
            label="Divisional secretariats covered"
            value={formData.divisionalSecretariats}
            onChange={(v) => setField("divisionalSecretariats", v)}
            onBlur={() => blurField("divisionalSecretariats")}
            error={errors.divisionalSecretariats}
            placeholder="e.g., Panadura, Beruwala"
            icon={MapPin}
            optional
          />
          <SelectField
            id="clearanceLevel"
            label="Clearance level"
            value={formData.clearanceLevel}
            onChange={(v) => setField("clearanceLevel", v)}
            onBlur={() => blurField("clearanceLevel")}
            error={errors.clearanceLevel}
            options={CLEARANCE_LEVELS}
            placeholder="Select clearance level"
          />
          <LockedField
            id="interface"
            label="Signs in to"
            value="DMC portal only"
            icon={BadgeCheck}
          />
        </FormSection>

        <FormSection
          icon={LockKeyhole}
          title="Account setup"
          caption="Your username is taken from your official email."
        >
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
        body="A Super Admin confirms your officer ID and district assignment with the DMC before the account is activated."
      />
    </RegistrationShell>
  );
}
