import { View } from "react-native";

import {
  ErrorSummary,
  Field,
  FormSection,
  Notice,
  PasswordField,
  RequestError,
  SubmitButton,
} from "./dushani-RegistrationUI";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  address as addressRule,
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optionalNic as nicRule,
  password as passwordRule,
  phone as phoneRule,
  positiveInteger,
  required as requiredRule,
  username as usernameRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

export type TeamLeaderVariant = "organization" | "independent";

interface TeamLeaderFormProps {
  variant: TeamLeaderVariant;
  onSuccess: (registrationType: string) => void;
}

const BASE_RULES: Record<string, Validator> = {
  teamName: requiredRule("Team name"),
  leaderFullName: requiredRule("Team leader full name"),
  nicNumber: nicRule,
  contactNumber: phoneRule,
  email: emailRule,
  teamAddress: addressRule,
  operatingDistrict: requiredRule("Operating district"),
  numberOfMembers: positiveInteger("Number of members"),
  teamMemberDetails: requiredRule("Team member details"),
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

const ORGANIZATION_RULES: Record<string, Validator> = {
  organizationName: requiredRule("Organization name"),
  organizationRegistrationNumber: requiredRule(
    "Organization registration number"
  ),
};

export default function TeamLeaderForm({
  variant,
  onSuccess,
}: TeamLeaderFormProps) {
  const isOrganization = variant === "organization";
  const registrationType = isOrganization
    ? "organization-team-leader"
    : "independent-team-leader";

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
      organizationRegistrationNumber: "",
      teamName: "",
      leaderFullName: "",
      nicNumber: "",
      contactNumber: "",
      email: "",
      teamAddress: "",
      operatingDistrict: "",
      numberOfMembers: "",
      teamMemberDetails: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: isOrganization ? { ...ORGANIZATION_RULES, ...BASE_RULES } : BASE_RULES,
    onSubmit: (values) => registerAccount(registrationType, values),
  });

  const handleSubmit = async () => {
    if (await submit()) onSuccess(registrationType);
  };

  return (
    <>
      {isOrganization && (
        <FormSection
          title="Your organization"
          caption="Use the same name and registration number your organization admin registered with."
          icon="business-outline"
        >
          <View className="space-y-4">
            <Field
              label="Organization name"
              value={formData.organizationName}
              onChange={(v) => setField("organizationName", v)}
              onBlur={() => blurField("organizationName")}
              error={errors.organizationName}
              placeholder="Enter organization name"
              autoCapitalize="words"
            />
            <Field
              label="Organization registration number"
              value={formData.organizationRegistrationNumber}
              onChange={(v) =>
                setField("organizationRegistrationNumber", v)
              }
              onBlur={() => blurField("organizationRegistrationNumber")}
              error={errors.organizationRegistrationNumber}
              placeholder="e.g. NGO-881"
              autoCapitalize="characters"
            />
          </View>
        </FormSection>
      )}

      <FormSection
        title="Team details"
        caption="This is the account your team will sign in to."
        icon="people-outline"
      >
        <View className="space-y-4">
          <Field
            label="Team name"
            value={formData.teamName}
            onChange={(v) => setField("teamName", v)}
            onBlur={() => blurField("teamName")}
            error={errors.teamName}
            placeholder="Enter your team name"
            autoCapitalize="words"
          />
          <Field
            label="Number of members"
            value={formData.numberOfMembers}
            onChange={(v) => setField("numberOfMembers", v)}
            onBlur={() => blurField("numberOfMembers")}
            error={errors.numberOfMembers}
            placeholder="e.g. 9"
            keyboardType="number-pad"
          />
          <Field
            label="Team member details"
            value={formData.teamMemberDetails}
            onChange={(v) => setField("teamMemberDetails", v)}
            onBlur={() => blurField("teamMemberDetails")}
            error={errors.teamMemberDetails}
            placeholder="e.g. 1 driver, 2 loaders, 6 field helpers"
            multiline
          />
        </View>
      </FormSection>

      <FormSection
        title="Leader and base"
        caption="Rescue requests route to the team leader first. Your operating district does not limit which affected district you are assigned to."
        icon="call-outline"
      >
        <View className="space-y-4">
          <Field
            label="Team leader full name"
            value={formData.leaderFullName}
            onChange={(v) => setField("leaderFullName", v)}
            onBlur={() => blurField("leaderFullName")}
            error={errors.leaderFullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
          <Field
            label="NIC number"
            value={formData.nicNumber}
            onChange={(v) => setField("nicNumber", v)}
            onBlur={() => blurField("nicNumber")}
            error={errors.nicNumber}
            placeholder="123456789V or 123456789012"
            keyboardType="number-pad"
            optional
          />
          <Field
            label="Contact number"
            value={formData.contactNumber}
            onChange={(v) => setField("contactNumber", v)}
            onBlur={() => blurField("contactNumber")}
            error={errors.contactNumber}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
          />
          <Field
            label="Email"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="leader@example.com"
            keyboardType="email-address"
          />
          <Field
            label="Team address"
            value={formData.teamAddress}
            onChange={(v) => setField("teamAddress", v)}
            onBlur={() => blurField("teamAddress")}
            error={errors.teamAddress}
            placeholder="No. 21, Temple Road"
            autoCapitalize="words"
          />
          <Field
            label="Operating district"
            value={formData.operatingDistrict}
            onChange={(v) => setField("operatingDistrict", v)}
            onBlur={() => blurField("operatingDistrict")}
            error={errors.operatingDistrict}
            placeholder="Enter your operating district"
            autoCapitalize="words"
          />
        </View>
      </FormSection>

      <FormSection
        title="Account setup"
        caption="The same credentials work on this app and on the SafePlus DMC portal."
        icon="lock-closed-outline"
      >
        <View className="space-y-4">
          <Field
            label="Username"
            value={formData.username}
            onChange={(v) => setField("username", v)}
            onBlur={() => blurField("username")}
            error={errors.username}
            placeholder="3-20 letters, numbers, . _ -"
          />
          <PasswordField
            label="Password"
            value={formData.password}
            onChange={(v) => setField("password", v)}
            onBlur={() => blurField("password")}
            error={errors.password}
            placeholder="At least 8 characters"
            hint="Upper, lower, number"
          />
          <PasswordField
            label="Confirm password"
            value={formData.confirmPassword}
            onChange={(v) => setField("confirmPassword", v)}
            onBlur={() => blurField("confirmPassword")}
            error={errors.confirmPassword}
            placeholder="Re-enter your password"
          />
        </View>
      </FormSection>

      <RequestError message={submitError} />
      <ErrorSummary count={Object.keys(errors).length} />

      <SubmitButton
        onPress={handleSubmit}
        disabled={isSubmitting}
        label={isSubmitting ? "Submitting team..." : "Submit team for verification"}
      />

      <Notice
        tone="pending"
        title={
          isOrganization
            ? "Approved by your organization admin"
            : "Approved by a Super Admin"
        }
        body="You can sign in now to track the team status. Rescue assignments open once the team is approved."
      />
    </>
  );
}
