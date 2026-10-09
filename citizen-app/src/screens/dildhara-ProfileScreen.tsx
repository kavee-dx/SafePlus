import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AuthApiError } from "../services/dildhara-authApi";
import { updateMyProfile, type Profile } from "../services/dildhara-profileApi";
import {
  Field,
  ProfileHeader,
  Section,
} from "../components/dildhara-ProfileParts";
import { ChipField, EditField } from "../components/dildhara-EditFields";
import MyResourcesScreen from "./dildhara-MyResourcesScreen";
import ProvideResourceScreen from "./dildhara-ProvideResourceScreen";
import RequestResourceScreen from "./dildhara-RequestResourceScreen";
import MyResourceRequestsScreen from "./dildhara-MyResourceRequestsScreen";

type Value = string | number | boolean | null | undefined;

interface FieldDef {
  key: string;
  label: string;
  source: "user" | "details";
  editable?: boolean;
  multiline?: boolean;
  keyboard?: "default" | "phone-pad" | "numeric" | "email-address";
  options?: readonly string[];
  hint?: string;
  when?: (profile: Profile) => boolean;
}

interface SectionDef {
  title: string;
  fields: FieldDef[];
  when?: (profile: Profile) => boolean;
}

// u = field stored in the users table, d = field in the role's own table.
const u = (
  key: string,
  label: string,
  editable = false,
  extra: Partial<FieldDef> = {}
): FieldDef => ({ key, label, source: "user", editable, ...extra });

const d = (
  key: string,
  label: string,
  editable = false,
  extra: Partial<FieldDef> = {}
): FieldDef => ({ key, label, source: "details", editable, ...extra });

const PHONE = { keyboard: "phone-pad" } as const;
const NUMBER = { keyboard: "numeric" } as const;
const GENDERS = ["Male", "Female", "Other"] as const;
const VEHICLE_TYPES = [
  "Motorcycle",
  "Three-Wheeler",
  "Car",
  "Van",
  "Lorry",
  "Other",
] as const;

const hasVehicle = (p: Profile) => p.details?.hasVehicle === true;
const hasOrganization = (p: Profile) => Boolean(p.details?.organizationName);

function vehicleSection(withDriver: boolean): SectionDef {
  return {
    title: "Vehicle",
    fields: [
      d("hasVehicle", "Has a vehicle"),
      d("vehicleType", "Vehicle type", true, { options: VEHICLE_TYPES, when: hasVehicle }),
      d("vehicleRegistrationNumber", "Registration number", true, { when: hasVehicle }),
      d("vehicleCapacity", "Capacity", true, { when: hasVehicle }),
      ...(withDriver
        ? [d("driverName", "Driver or responsible person", true, { when: hasVehicle })]
        : []),
      d("drivingLicenseNumber", "Driving license", true, { when: hasVehicle }),
    ],
  };
}

const TEAM_SECTION: SectionDef = {
  title: "Team",
  fields: [
    d("teamName", "Team name", true),
    d("operatingDistrict", "Operating district", true),
    d("memberCount", "Number of members", true, NUMBER),
    d("memberDetails", "Member details", true, { multiline: true }),
    d("address", "Address", true, { multiline: true }),
  ],
};

const ORGANIZATION_SECTION: SectionDef = {
  title: "Organization",
  when: hasOrganization,
  fields: [
    d("organizationName", "Name"),
    d("organizationRegistrationNumber", "Registration number"),
    d("verifiedBy", "Verified by"),
  ],
};

const LEADER_FIELDS = [
  d("leaderFullName", "Name", true),
  d("leaderPhoneNumber", "Phone", true, PHONE),
  u("email", "Email"),
];

const ROLE_SECTIONS: Record<string, SectionDef[]> = {
  CITIZEN: [
    {
      title: "Personal details",
      fields: [
        u("fullName", "Full name", true),
        u("nicNumber", "NIC number", true),
        u("dateOfBirth", "Date of birth", true, { hint: "YYYY-MM-DD" }),
        u("gender", "Gender", true, { options: GENDERS }),
      ],
    },
    {
      title: "Contact & address",
      fields: [
        u("email", "Email"),
        u("phoneNumber", "Phone", true, PHONE),
        u("address", "Address", true),
        u("city", "City", true),
        u("district", "District", true),
        u("postalCode", "Postal code", true, NUMBER),
      ],
    },
  ],

  FOOD_DONOR: [
    {
      title: "Personal details",
      fields: [u("fullName", "Full name", true), u("nicNumber", "NIC number", true)],
    },
    {
      title: "Contact & address",
      fields: [
        u("email", "Email"),
        u("phoneNumber", "Phone", true, PHONE),
        u("address", "Address", true),
        u("city", "City", true),
        u("district", "District", true),
      ],
    },
  ],

  DELIVERY_VOLUNTEER: [
    {
      title: "Personal details",
      fields: [u("fullName", "Full name", true), u("nicNumber", "NIC number", true)],
    },
    {
      title: "Contact & address",
      fields: [
        u("email", "Email"),
        u("phoneNumber", "Phone", true, PHONE),
        u("address", "Address", true),
        u("city", "City", true),
        u("district", "District", true),
      ],
    },
    {
      title: "Emergency contact",
      fields: [
        d("emergencyContactName", "Name", true),
        d("emergencyContactNumber", "Phone", true, PHONE),
      ],
    },
    vehicleSection(false),
  ],

  DELIVERY_VOLUNTEER_TEAM: [
    {
      ...TEAM_SECTION,
      fields: [
        d("teamRegistrationNumber", "Registration number"),
        ...TEAM_SECTION.fields,
      ],
    },
    { title: "Team leader", fields: LEADER_FIELDS },
    vehicleSection(true),
  ],

  ORGANIZATION_TEAM_LEADER: [
    TEAM_SECTION,
    { title: "Team leader", fields: [...LEADER_FIELDS, u("nicNumber", "NIC number", true)] },
    ORGANIZATION_SECTION,
  ],

  INDEPENDENT_TEAM_LEADER: [
    TEAM_SECTION,
    { title: "Team leader", fields: [...LEADER_FIELDS, u("nicNumber", "NIC number", true)] },
  ],

  RELIEF_AGENCY: [
    {
      title: "Organization",
      fields: [
        d("agencyName", "Name"),
        d("organizationType", "Type"),
        d("registrationNumber", "Registration number"),
        d("district", "District"),
        d("address", "Address", true, { multiline: true }),
        d("operatingArea", "Operating area", true),
      ],
    },
    {
      title: "Contact person",
      fields: [
        d("contactPerson", "Name", true),
        d("contactPhoneNumber", "Phone", true, PHONE),
        u("email", "Email"),
      ],
    },
  ],
};

function readValue(profile: Profile, field: FieldDef): Value {
  return field.source === "user"
    ? (profile.user as unknown as Record<string, Value>)[field.key]
    : profile.details?.[field.key];
}

const asText = (value: Value): string =>
  value === null || value === undefined ? "" : String(value);

interface ProfileScreenProps {
  token: string;
  profile: Profile;
  onProfileUpdated: (profile: Profile) => void;
  onSessionExpired: () => void;
}

export default function ProfileScreen({
  token,
  profile,
  onProfileUpdated,
  onSessionExpired,
}: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [resourcePage, setResourcePage] = useState<
  "none" | "my" | "provide" | "request" | "myRequests"
>("none");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleField = (field: FieldDef) => !field.when || field.when(profile);

  const sections = (ROLE_SECTIONS[profile.user.role] ?? []).filter(
    (section) => !section.when || section.when(profile)
  );

  const editableFields = sections
    .flatMap((section) => section.fields)
    .filter((field) => field.editable && visibleField(field));

  const setDraftValue = (key: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const startEdit = () => {
    const next: Record<string, string> = {};
    for (const field of editableFields) {
      next[field.key] = asText(readValue(profile, field));
    }

    setDraft(next);
    setFieldErrors({});
    setSaveError("");
    setNotice("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFieldErrors({});
    setSaveError("");
  };

  const handleSave = async () => {
    if (saving) return;

    const changes: Record<string, string> = {};
    for (const field of editableFields) {
      const current = (draft[field.key] ?? "").trim();
      if (current !== asText(readValue(profile, field))) {
        changes[field.key] = current;
      }
    }

    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setSaveError("");

    try {
      const updated = await updateMyProfile(token, changes);
      onProfileUpdated(updated);
      setEditing(false);
      setNotice("Your profile has been updated.");
    } catch (error) {
      if (error instanceof AuthApiError) {
        if (error.status === 401) {
          onSessionExpired();
          return;
        }
        setFieldErrors(error.fieldErrors);
        setSaveError(error.message);
      } else {
        setSaveError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FieldDef) => {
    if (editing && field.editable) {
      const error = fieldErrors[field.key];
      const value = draft[field.key] ?? "";

      return field.options ? (
        <ChipField
          key={field.key}
          label={field.label}
          value={value}
          options={field.options}
          onChange={(next) => setDraftValue(field.key, next)}
          error={error}
        />
      ) : (
        <EditField
          key={field.key}
          label={field.label}
          value={value}
          onChangeText={(next) => setDraftValue(field.key, next)}
          error={error}
          multiline={field.multiline}
          keyboardType={field.keyboard}
          hint={field.hint}
        />
      );
    }

    return (
      <Field
        key={field.key}
        label={field.label}
        value={readValue(profile, field)}
      />
    );
  };

  const headerName = String(profile.details?.agencyName ?? profile.user.fullName);
const canProvideResources =
  profile.user.role === "RELIEF_AGENCY" ||
  profile.user.role === "FOOD_DONOR";
  const canRequestResources =
  profile.user.role === "CITIZEN";
 if (resourcePage === "provide") {
  return (
    <ProvideResourceScreen
      token={token}
      onSuccess={() => setResourcePage("none")}
      onCancel={() => setResourcePage("none")}
      onSessionExpired={onSessionExpired}
    />
  );
}

if (resourcePage === "my") {
  return (
    <MyResourcesScreen
      token={token}
      onProvideResource={() => setResourcePage("provide")}
      onBack={() => setResourcePage("none")}
      onSessionExpired={onSessionExpired}
    />
  );
}
if (resourcePage === "request") {
  return (
    <RequestResourceScreen
      token={token}
      onSuccess={() => setResourcePage("myRequests")}
      onCancel={() => setResourcePage("none")}
      onSessionExpired={onSessionExpired}
    />
  );
}

if (resourcePage === "myRequests") {
  return (
    <MyResourceRequestsScreen
      token={token}
      onBack={() => setResourcePage("none")}
      onRequestResource={() =>
        setResourcePage("request")
      }
      onSessionExpired={onSessionExpired}
    />
  );
}
  return (
    <View>
      <ProfileHeader
        name={headerName}
        role={profile.user.role}
        status={profile.user.status}
      />

      {!editing ? (
        <Pressable
          onPress={startEdit}
          className="items-center justify-center mb-4 h-12 rounded-2xl bg-safeplus-green active:opacity-80"
        >
          <Text className="text-base font-extrabold text-white">Edit profile</Text>
        </Pressable>
      ) : (
        <View className="flex-row gap-3 mb-4">
          <Pressable
            onPress={cancelEdit}
            disabled={saving}
            className="items-center justify-center flex-1 h-12 bg-white border rounded-2xl border-safeplus-border active:opacity-80"
          >
            <Text className="text-base font-extrabold text-safeplus-text">Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className="items-center justify-center flex-1 h-12 rounded-2xl bg-safeplus-green active:opacity-80"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-extrabold text-white">Save</Text>
            )}
          </Pressable>
        </View>
      )}

      {notice ? (
        <Text className="mb-3 text-sm font-bold text-safeplus-darkGreen">{notice}</Text>
      ) : null}

      {saveError ? (
        <Text className="mb-3 text-sm font-bold text-red-600">{saveError}</Text>
      ) : null}

      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.fields.filter(visibleField).map(renderField)}
        </Section>
      ))}
      {/* {canRequestResources ? (
  <Section title="Resource Requests">
    <Text className="mb-3 text-sm leading-5 text-safeplus-muted">
      Request resources that you need
      during an emergency.
    </Text>

    <Pressable
      onPress={() =>
        setResourcePage("myRequests")
      }
      className="items-center justify-center h-12 mb-3 rounded-2xl bg-safeplus-green"
    >
      <Text className="text-base font-extrabold text-white">
        My Requests
      </Text>
    </Pressable>

    <Pressable
      onPress={() =>
        setResourcePage("request")
      }
      className="items-center justify-center h-12 bg-white border rounded-2xl border-safeplus-border"
    >
      <Text className="text-base font-extrabold text-safeplus-darkGreen">
        + Request Resource
      </Text>
    </Pressable>
  </Section>
) : null} */}
      {/* {canProvideResources ? ( */}
      {/* {canProvideResources ? (
  <Section title="Relief Resources">
    <Text className="mb-3 text-sm leading-5 text-safeplus-muted">
      Provide resources that you are willing to make
      available for emergency relief operations.
    </Text>

    <Pressable
      onPress={() => setResourcePage("my")}
      className="items-center justify-center h-12 mb-3 rounded-2xl bg-safeplus-green"
    >
      <Text className="text-base font-extrabold text-white">
        My Resources
      </Text>
    </Pressable>

    <Pressable
      onPress={() => setResourcePage("provide")}
      className="items-center justify-center h-12 bg-white border rounded-2xl border-safeplus-border"
    >
      <Text className="text-base font-extrabold text-safeplus-darkGreen">
        + Provide Resource
      </Text>
    </Pressable>
  </Section>
) : null} */}

      {editing ? (
        <Text className="mb-4 text-xs leading-5 text-safeplus-muted">
          Only fields with an input box can be changed. Email and details
          verified when your account was approved stay locked.
        </Text>
      ) : null}
    </View>
  );
}