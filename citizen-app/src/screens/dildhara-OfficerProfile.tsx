import { View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { Field, ProfileHeader, Section } from "../components/dildhara-ProfileParts";

export default function OfficerProfile({ profile }: { profile: Profile }) {
  const u = profile.user;
  const d = profile.details ?? {};

  return (
    <View>
      <ProfileHeader name={u.fullName} role={u.role} status={u.status} />

      <Section title="Official details">
        <Field label="Officer ID" value={d.officerId} />
        {d.designation !== undefined ? (
          <Field label="Designation" value={d.designation} />
        ) : null}
        {d.dmcOffice !== undefined ? (
          <Field label="DMC office" value={d.dmcOffice} />
        ) : null}
        <Field label="District" value={d.assignedDistrict ?? d.district} />
        {d.divisionalSecretariats !== undefined ? (
          <Field
            label="Divisional secretariats"
            value={d.divisionalSecretariats}
          />
        ) : null}
        <Field label="Clearance" value={d.clearanceLevel ?? d.clearanceInfo} />
      </Section>

      <Section title="Contact">
        <Field label="Official email" value={u.email} />
        <Field label="Phone" value={d.dutyPhoneNumber ?? u.phoneNumber} />
      </Section>
    </View>
  );
}