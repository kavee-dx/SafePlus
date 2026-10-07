import { View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { Field, ProfileHeader, Section } from "../components/dildhara-ProfileParts";

export default function VolunteerProfile({ profile }: { profile: Profile }) {
  const u = profile.user;
  const d = profile.details ?? {};

  return (
    <View>
      <ProfileHeader name={u.fullName} role={u.role} status={u.status} />

      <Section title="Personal details">
        <Field label="Full name" value={u.fullName} />
        <Field label="NIC number" value={u.nicNumber} />
        <Field label="Email" value={u.email} />
        <Field label="Phone" value={u.phoneNumber} />
        <Field label="Address" value={u.address} />
        <Field label="City" value={u.city} />
        <Field label="District" value={u.district} />
      </Section>

      <Section title="Emergency contact">
        <Field label="Name" value={d.emergencyContactName} />
        <Field label="Phone" value={d.emergencyContactNumber} />
      </Section>

      <Section title="Vehicle">
        <Field label="Has a vehicle" value={d.hasVehicle} />
        {d.hasVehicle ? (
          <>
            <Field label="Type" value={d.vehicleType} />
            <Field label="Registration number" value={d.vehicleRegistrationNumber} />
            <Field label="Capacity" value={d.vehicleCapacity} />
            <Field label="Driving license" value={d.drivingLicenseNumber} />
          </>
        ) : null}
      </Section>
    </View>
  );
}