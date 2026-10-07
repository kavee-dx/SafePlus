import { Pressable, Text, View } from "react-native";

import {
  ErrorSummary,
  Field,
  FieldError,
  FormScreenShell,
  FormSection,
  Notice,
  PasswordField,
  RequestError,
  SubmitButton,
} from "../components/dushani-RegistrationUI";
import { useRegistrationForm } from "../hooks/dushani-useRegistrationForm";
import { registerAccount } from "../services/dushani-registrationApi";
import {
  address as addressRule,
  confirmPassword as confirmPasswordRule,
  email as emailRule,
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  username as usernameRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface ReliefAgencyRegistrationScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

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
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

const ORGANIZATION_TYPES = [
  "Government Agency",
  "NGO",
  "Military",
  "Other Relief Organization",
];

export default function ReliefAgencyRegistrationScreen({
  onBack,
  onSuccess,
}: ReliefAgencyRegistrationScreenProps) {
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
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("relief-agency", values),
  });

  const handleSubmit = async () => {
    if (await submit()) onSuccess();
  };

  return (
    <FormScreenShell
      title="Register your organization"
      subtitle="Agencies and NGOs working in disaster response"
      onBack={onBack}
    >
      <FormSection
        title="Organization"
        caption="We verify this against your official registration number."
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
          <View>
            <Text className="mb-2 text-[15px] font-bold text-safeplus-navy">
              Organization type
              <Text className="text-safeplus-red">  *</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ORGANIZATION_TYPES.map((type) => {
                const isSelected = formData.organizationType === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setField("organizationType", type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className={`items-center justify-center px-4 h-12 rounded-xl border ${
                      isSelected
                        ? "bg-safeplus-navy border-safeplus-navy"
                        : "bg-safeplus-fieldBg border-safeplus-hairline"
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        isSelected ? "text-white" : "text-safeplus-navy"
                      }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-2">
              <FieldError message={errors.organizationType} />
            </View>
          </View>
          <Field
            label="Registration number"
            value={formData.registrationNumber}
            onChange={(v) => setField("registrationNumber", v)}
            onBlur={() => blurField("registrationNumber")}
            error={errors.registrationNumber}
            placeholder="e.g., NGO-2019-0452"
          />
        </View>
      </FormSection>

      <FormSection
        title="Primary contact"
        caption="The person our operations room calls first."
        icon="call-outline"
      >
        <View className="space-y-4">
          <Field
            label="Contact person"
            value={formData.contactPerson}
            onChange={(v) => setField("contactPerson", v)}
            onBlur={() => blurField("contactPerson")}
            error={errors.contactPerson}
            placeholder="Enter contact person name"
            autoCapitalize="words"
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
            label="Official email"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="name@organization.lk"
            keyboardType="email-address"
          />
        </View>
      </FormSection>

      <FormSection title="Where you operate" icon="location-outline">
        <View className="space-y-4">
          <Field
            label="Organization address"
            value={formData.organizationAddress}
            onChange={(v) => setField("organizationAddress", v)}
            onBlur={() => blurField("organizationAddress")}
            error={errors.organizationAddress}
            placeholder="No. 123, Main Street"
            autoCapitalize="words"
          />
          <Field
            label="District"
            value={formData.district}
            onChange={(v) => setField("district", v)}
            onBlur={() => blurField("district")}
            error={errors.district}
            placeholder="Enter your district"
            autoCapitalize="words"
          />
          <Field
            label="Operating area"
            value={formData.operatingArea}
            onChange={(v) => setField("operatingArea", v)}
            onBlur={() => blurField("operatingArea")}
            error={errors.operatingArea}
            placeholder="e.g., Kalu Ganga basin, Western Province"
            autoCapitalize="words"
            optional
          />
        </View>
      </FormSection>

      <FormSection
        title="Account setup"
        caption="You will sign in with these credentials."
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
        label={isSubmitting ? "Submitting..." : "Submit for verification"}
      />

      <Notice
        tone="pending"
        title="Verified before access"
        body="Your registration number is checked by the DMC. You can sign in to track the status, but relief requests unlock after approval."
      />
    </FormScreenShell>
  );
}
