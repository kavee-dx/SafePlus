import { View } from "react-native";

import {
  ChoiceField,
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
  drivingLicenseNumber as drivingLicenseRule,
  email as emailRule,
  optionalNic,
  password as passwordRule,
  phone as phoneRule,
  required as requiredRule,
  username as usernameRule,
  vehicleCapacity as vehicleCapacityRule,
  vehicleHasVehicle,
  vehicleRegistrationNumber as vehicleRegistrationRule,
  vehicleType as vehicleTypeRule,
  VEHICLE_FIELDS,
  VEHICLE_TYPES,
  YES_NO,
  type Validator,
} from "../utils/dushani-registrationValidation";

interface DeliveryVolunteerFormProps {
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
  emergencyContactName: requiredRule("Emergency contact name"),
  emergencyContactNumber: phoneRule,
  hasVehicle: vehicleHasVehicle,
  vehicleRegistrationNumber: vehicleRegistrationRule,
  vehicleType: vehicleTypeRule,
  vehicleCapacity: vehicleCapacityRule,
  drivingLicenseNumber: drivingLicenseRule,
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

export default function DeliveryVolunteerForm({
  onSuccess,
}: DeliveryVolunteerFormProps) {
  const {
    formData,
    errors,
    submitError,
    isSubmitting,
    setField,
    blurField,
    clearErrors,
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
      emergencyContactName: "",
      emergencyContactNumber: "",
      hasVehicle: "",
      vehicleRegistrationNumber: "",
      vehicleType: "",
      vehicleCapacity: "",
      drivingLicenseNumber: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("delivery-volunteer", values),
  });

  const hasVehicle = formData.hasVehicle === "Yes";

  const selectVehicleAnswer = (value: string) => {
    setField("hasVehicle", value);
    if (value === "No") clearErrors(VEHICLE_FIELDS);
  };

  const handleSubmit = async () => {
    if (await submit()) onSuccess();
  };

  return (
    <>
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
        title="Contact and delivery area"
        caption="Your current operating area. The coordinator can still assign you to another district."
        icon="location-outline"
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
            label="Contact number"
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
        title="Emergency contact"
        caption="We call this person if we cannot reach you during a delivery."
        icon="medkit-outline"
      >
        <View className="space-y-4">
          <Field
            label="Emergency contact name"
            value={formData.emergencyContactName}
            onChange={(v) => setField("emergencyContactName", v)}
            onBlur={() => blurField("emergencyContactName")}
            error={errors.emergencyContactName}
            placeholder="Enter emergency contact name"
            autoCapitalize="words"
          />
          <Field
            label="Emergency contact number"
            value={formData.emergencyContactNumber}
            onChange={(v) => setField("emergencyContactNumber", v)}
            onBlur={() => blurField("emergencyContactNumber")}
            error={errors.emergencyContactNumber}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
          />
        </View>
      </FormSection>

      <FormSection
        title="Vehicle availability"
        caption="Tell us if you can bring a vehicle. You can add it later from your dashboard."
        icon="car-outline"
      >
        <View className="space-y-4">
          <ChoiceField
            label="Do you have a vehicle available for delivery?"
            value={formData.hasVehicle}
            options={YES_NO}
            onChange={selectVehicleAnswer}
            error={errors.hasVehicle}
          />

          {hasVehicle && (
            <>
              <Field
                label="Vehicle registration number"
                value={formData.vehicleRegistrationNumber}
                onChange={(v) => setField("vehicleRegistrationNumber", v)}
                onBlur={() => blurField("vehicleRegistrationNumber")}
                error={errors.vehicleRegistrationNumber}
                placeholder="LR 4521"
                autoCapitalize="characters"
              />
              <ChoiceField
                label="Vehicle type"
                value={formData.vehicleType}
                options={VEHICLE_TYPES}
                onChange={(v) => setField("vehicleType", v)}
                error={errors.vehicleType}
              />
              <Field
                label="Vehicle capacity"
                value={formData.vehicleCapacity}
                onChange={(v) => setField("vehicleCapacity", v)}
                onBlur={() => blurField("vehicleCapacity")}
                error={errors.vehicleCapacity}
                placeholder="e.g. 20 boxes / 500 kg"
              />
              <Field
                label="Driving license number"
                value={formData.drivingLicenseNumber}
                onChange={(v) => setField("drivingLicenseNumber", v)}
                onBlur={() => blurField("drivingLicenseNumber")}
                error={errors.drivingLicenseNumber}
                placeholder="B-123456"
                autoCapitalize="characters"
              />
            </>
          )}
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
        label={
          isSubmitting
            ? "Creating account..."
            : "Create delivery volunteer account"
        }
      />

      <Notice
        tone="success"
        title="Activated immediately"
        body="Availability and skills can be added later from your delivery volunteer dashboard."
      />
    </>
  );
}
