import { View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { Field, ProfileHeader, Section } from "../components/dildhara-ProfileParts";

export default function OrganizationProfile({ profile }: { profile: Profile }) {
  const u = profile.user;
  const d = profile.details ?? {};

  return (
    <View>
      <ProfileHeader
        name={String(d.agencyName ?? d.organizationName ?? u.fullName)}
        role={u.role}
        status={u.status}
      />

      <Section title="Organization">
        <Field label="Name" value={d.agencyName ?? d.organizationName} />
        <Field label="Type" value={d.organizationType} />
        <Field label="Registration number" value={d.registrationNumber} />
        <Field label="District" value={d.district} />
        <Field label="Operating area" value={d.operatingArea} />
        <Field label="Address" value={d.address} />
        {d.rescueTeamCount !== undefined ? (
          <Field label="Rescue teams" value={d.rescueTeamCount} />
        ) : null}
      </Section>

      <Section title="Contact person">
        <Field label="Name" value={d.contactPerson} />
        <Field label="Phone" value={d.contactPhoneNumber} />
        <Field label="Email" value={u.email} />
      </Section>
    </View>
  );
}