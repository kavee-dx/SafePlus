import { View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { Field, ProfileHeader, Section } from "../components/dildhara-ProfileParts";

export default function TeamProfile({ profile }: { profile: Profile }) {
  const u = profile.user;
  const d = profile.details ?? {};

  return (
    <View>
      <ProfileHeader name={u.fullName} role={u.role} status={u.status} />

      <Section title="Team">
        <Field label="Team name" value={d.teamName} />
        <Field label="Registration number" value={d.teamRegistrationNumber} />
        <Field label="Operating district" value={d.operatingDistrict} />
        <Field label="Number of members" value={d.memberCount} />
        <Field label="Member details" value={d.memberDetails} />
        <Field label="Address" value={d.address} />
      </Section>

      <Section title="Team leader">
        <Field label="Name" value={d.leaderFullName} />
        <Field label="Phone" value={d.leaderPhoneNumber} />
        <Field label="Email" value={u.email} />
        <Field label="NIC number" value={u.nicNumber} />
      </Section>

      {d.organizationName ? (
        <Section title="Organization">
          <Field label="Name" value={d.organizationName} />
          <Field
            label="Registration number"
            value={d.organizationRegistrationNumber}
          />
          <Field label="Verified by" value={d.verifiedBy} />
        </Section>
      ) : null}

      {d.hasVehicle ? (
        <Section title="Vehicle">
          <Field label="Type" value={d.vehicleType} />
          <Field label="Registration number" value={d.vehicleRegistrationNumber} />
          <Field label="Capacity" value={d.vehicleCapacity} />
          <Field label="Driver" value={d.driverName} />
          <Field label="Driving license" value={d.drivingLicenseNumber} />
        </Section>
      ) : null}
    </View>
  );
}