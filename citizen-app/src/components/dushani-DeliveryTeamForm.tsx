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
  optional as optionalRule,
  password as passwordRule,
  phone as phoneRule,
  positiveInteger,
  required as requiredRule,
  requiredWhen,
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

interface DeliveryTeamFormProps {
  onSuccess: () => void;
}

const RULES: Record<string, Validator> = {
  teamName: requiredRule("Team name"),
  numberOfMembers: positiveInteger("Number of members"),
  teamMemberDetails: requiredRule("Team member details"),
  teamRegistrationNumber: optionalRule("Team registration number"),
  teamLeaderName: requiredRule("Team leader name"),
  teamLeaderContact: phoneRule,
  email: emailRule,
  teamAddress: addressRule,
  operatingDistrict: requiredRule("Operating district"),
  hasVehicle: vehicleHasVehicle,
  vehicleRegistrationNumber: vehicleRegistrationRule,
  vehicleType: vehicleTypeRule,
  vehicleCapacity: vehicleCapacityRule,
  driverName: requiredWhen("Driver or responsible person", (values) =>
    values.hasVehicle === "Yes"
  ),
  drivingLicenseNumber: drivingLicenseRule,
  username: usernameRule,
  password: passwordRule,
  confirmPassword: confirmPasswordRule,
};

export default function DeliveryTeamForm({
  onSuccess,
}: DeliveryTeamFormProps) {
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
      teamName: "",
      teamLeaderName: "",
      teamLeaderContact: "",
      email: "",
      teamAddress: "",
      operatingDistrict: "",
      numberOfMembers: "",
      teamMemberDetails: "",
      teamRegistrationNumber: "",
      hasVehicle: "",
      vehicleRegistrationNumber: "",
      vehicleType: "",
      vehicleCapacity: "",
      driverName: "",
      drivingLicenseNumber: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    rules: RULES,
    onSubmit: (values) => registerAccount("delivery-volunteer-team", values),
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
      <FormSection
        title="Team details"
        caption="This is the account your team leaders will sign in to."
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
            placeholder="e.g. 12"
            keyboardType="number-pad"
          />
          <Field
            label="Team member details"
            value={formData.teamMemberDetails}
            onChange={(v) => setField("teamMemberDetails", v)}
            onBlur={() => blurField("teamMemberDetails")}
            error={errors.teamMemberDetails}
            placeholder="e.g. 2 drivers, 4 loaders, 6 field helpers"
            multiline
          />
          <Field
            label="Team registration number"
            value={formData.teamRegistrationNumber}
            onChange={(v) => setField("teamRegistrationNumber", v)}
            onBlur={() => blurField("teamRegistrationNumber")}
            error={errors.teamRegistrationNumber}
            placeholder="Enter your registration number"
            optional
          />
        </View>
      </FormSection>

      <FormSection
        title="Leader and base"
        caption="Requests route to the team leader first. Your operating area does not restrict which affected district the team is assigned to."
        icon="call-outline"
      >
        <View className="space-y-4">
          <Field
            label="Team leader name"
            value={formData.teamLeaderName}
            onChange={(v) => setField("teamLeaderName", v)}
            onBlur={() => blurField("teamLeaderName")}
            error={errors.teamLeaderName}
            placeholder="Enter team leader name"
            autoCapitalize="words"
          />
          <Field
            label="Team leader contact"
            value={formData.teamLeaderContact}
            onChange={(v) => setField("teamLeaderContact", v)}
            onBlur={() => blurField("teamLeaderContact")}
            error={errors.teamLeaderContact}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
          />
          <Field
            label="Email"
            value={formData.email}
            onChange={(v) => setField("email", v)}
            onBlur={() => blurField("email")}
            error={errors.email}
            placeholder="team@email.com"
            keyboardType="email-address"
          />
          <Field
            label="Team address"
            value={formData.teamAddress}
            onChange={(v) => setField("teamAddress", v)}
            onBlur={() => blurField("teamAddress")}
            error={errors.teamAddress}
            placeholder="No. 123, Main Street"
            autoCapitalize="words"
          />
          <Field
            label="Operating district / area"
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
        title="Vehicle availability"
        caption="Vehicle type and capacity help the coordinator plan a delivery run."
        icon="car-outline"
      >
        <View className="space-y-4">
          <ChoiceField
            label="Does the team have a vehicle available for delivery?"
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
                placeholder="e.g. 40 boxes / 1 tonne"
              />
              <Field
                label="Driver or responsible person"
                value={formData.driverName}
                onChange={(v) => setField("driverName", v)}
                onBlur={() => blurField("driverName")}
                error={errors.driverName}
                placeholder="Enter driver name"
                autoCapitalize="words"
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
          isSubmitting ? "Creating account..." : "Create delivery team account"
        }
      />

      <Notice
        tone="success"
        title="Activated immediately"
        body="Extra vehicles and member lists can be added later from the team dashboard."
      />
    </>
  );
}
