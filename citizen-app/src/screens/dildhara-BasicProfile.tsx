import { View } from "react-native";

import type { Profile } from "../services/dildhara-profileApi";
import { Field, ProfileHeader, Section } from "../components/dildhara-ProfileParts";

export default function BasicProfile({ profile }: { profile: Profile }) {
  const u = profile.user;

  return (
    <View>
      <ProfileHeader name={u.fullName} role={u.role} status={u.status} />

      <Section title="Personal details">
        <Field label="Full name" value={u.fullName} />
        <Field label="NIC number" value={u.nicNumber} />
        <Field label="Date of birth" value={u.dateOfBirth} />
        <Field label="Gender" value={u.gender} />
      </Section>

      <Section title="Contact & address">
        <Field label="Email" value={u.email} />
        <Field label="Phone" value={u.phoneNumber} />
        <Field label="Address" value={u.address} />
        <Field label="City" value={u.city} />
        <Field label="District" value={u.district} />
        <Field label="Postal code" value={u.postalCode} />
      </Section>
    </View>
  );
}