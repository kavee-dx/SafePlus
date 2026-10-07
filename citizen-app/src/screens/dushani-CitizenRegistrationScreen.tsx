import { Pressable, Text, View } from "react-native";

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
  optionalDateOfBirth,
  optionalNic,
  optionalPostalCode,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  username as usernameRule,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface CitizenRegistrationScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

const RULES: Record<string, Validator> = {
  fullName: requiredRule("Full name"),
  nicNumber: optionalNic,
  dateOfBirth: optionalDateOfBirth,
  email: emailRule,
  mobileNumber: phoneRule,
  address: addressRule,
  city: requiredRule("City"),
  district: requiredRule("District"),
  postalCode: optionalPostalCode,
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

const GENDERS = ["Male", "Female", "Other"];

export default function CitizenRegistrationScreen({
  onBack,
  onSuccess,
}: CitizenRegistrationScreenProps) {
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
      dateOfBirth: "",
      gender: "",
      email: "",
      mobileNumber: "",
      address: "",
      city: "",
      district: "",
      postalCode: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("citizen", values),
  });

  const handleSubmit = async () => {
    if (await submit()) onSuccess();
  };

  return (
    <FormScreenShell
      title="Create your account"
      subtitle="Register as a citizen to get warnings and shelter info"
      onBack={onBack}
    >
      <FormSection title="Personal details" icon="person-outline">
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
          <Field
            label="Date of birth"
            value={formData.dateOfBirth}
            onChange={(v) => setField("dateOfBirth", v)}
            onBlur={() => blurField("dateOfBirth")}
            error={errors.dateOfBirth}
            placeholder="YYYY-MM-DD"
            optional
          />
          <View>
            <Text className="mb-2 text-[15px] font-bold text-safeplus-navy">
              Gender
              <Text className="text-[13px] font-semibold text-safeplus-slate">
                {"  "}(optional)
              </Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((gender) => {
                const isSelected = formData.gender === gender;

                return (
                  <Pressable
                    key={gender}
                    onPress={() => setField("gender", gender)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className={`items-center justify-center px-5 h-12 rounded-xl border ${
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
                      {gender}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </FormSection>

      <FormSection
        title="Contact"
        caption="Alerts are sent to this mobile number and email."
        icon="call-outline"
      >
        <View className="space-y-4">
          <Field
            label="Email address"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Field
            label="Mobile number"
            value={formData.mobileNumber}
            onChange={(v) => setField("mobileNumber", v)}
            onBlur={() => blurField("mobileNumber")}
            error={errors.mobileNumber}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
          />
        </View>
      </FormSection>

      <FormSection title="Address" icon="location-outline">
        <View className="space-y-4">
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
          <Field
            label="Postal code"
            value={formData.postalCode}
            onChange={(v) => setField("postalCode", v)}
            onBlur={() => blurField("postalCode")}
            error={errors.postalCode}
            placeholder="e.g., 10000"
            keyboardType="number-pad"
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
        label={isSubmitting ? "Creating account..." : "Create citizen account"}
      />

      <Notice
        tone="success"
        title="Activated immediately"
        body="No verification is needed — you can sign in as soon as you register."
      />
    </FormScreenShell>
  );
}
