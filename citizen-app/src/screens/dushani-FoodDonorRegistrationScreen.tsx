import { View } from "react-native";

import {
  ErrorSummary,
  Field,
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
  optionalNic,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  username as usernameRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface FoodDonorRegistrationScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

const RULES: Record<string, Validator> = {
  fullName: requiredRule("Full name"),
  nicNumber: optionalNic,
  email: emailRule,
  contactNumber: phoneRule,
  address: addressRule,
  city: requiredRule("City"),
  district: requiredRule("District"),
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

export default function FoodDonorRegistrationScreen({
  onBack,
  onSuccess,
}: FoodDonorRegistrationScreenProps) {
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
      nicNumber: "",
      contactNumber: "",
      email: "",
      address: "",
      city: "",
      district: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("food-donor", values),
  });

  const handleSubmit = async () => {
    if (await submit()) onSuccess();
  };

  return (
    <FormScreenShell
      title="Register as a food donor"
      subtitle="Offer meals and rations when a disaster hits"
      onBack={onBack}
    >
      <FormSection title="Your details" icon="person-outline">
        <View className="space-y-4">
          <Field
            label="Full name"
            value={formData.fullName}
            onChange={(v) => setField("fullName", v)}
            onBlur={() => blurField("fullName")}
            error={errors.fullName}
            placeholder="Enter your full name"
            autoCapitalize="words"
          />
          <Field
            label="NIC number"
            value={formData.nicNumber}
            onChange={(v) => setField("nicNumber", v)}
            onBlur={() => blurField("nicNumber")}
            error={errors.nicNumber}
            placeholder="921234567V or 12 digits"
            optional
          />
        </View>
      </FormSection>

      <FormSection
        title="Contact and collection point"
        caption="Relief teams use this to reach you when food is needed."
        icon="cube-outline"
      >
        <View className="space-y-4">
          <Field
            label="Email"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="your@email.com"
            keyboardType="email-address"
          />
          <Field
            label="Mobile number"
            value={formData.contactNumber}
            onChange={(v) => setField("contactNumber", v)}
            onBlur={() => blurField("contactNumber")}
            error={errors.contactNumber}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
          />
          <Field
            label="Address"
            value={formData.address}
            onChange={(v) => setField("address", v)}
            onBlur={() => blurField("address")}
            error={errors.address}
            placeholder="No. 123, Main Street"
            autoCapitalize="words"
          />
          <Field
            label="City"
            value={formData.city}
            onChange={(v) => setField("city", v)}
            onBlur={() => blurField("city")}
            error={errors.city}
            placeholder="Enter your city"
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
        label={isSubmitting ? "Creating account..." : "Create donor account"}
      />

      <Notice
        tone="success"
        title="Activated immediately"
        body="Add the food and rations you can offer later from your donor dashboard."
      />
    </FormScreenShell>
  );
}
