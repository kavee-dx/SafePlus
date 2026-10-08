import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import {
  ChoiceField,
  ErrorSummary,
  Field,
  FormScreenShell,
  FormSection,
  Notice,
  RequestError,
  SubmitButton,
} from "../components/dushani-RegistrationUI";
import {
  AlertApiError,
  fetchDistrictNames,
  saveAlertTarget,
  submitHazardReport,
  type NewHazardReport,
} from "../services/dushani-alertApi";
import type { FieldErrors } from "../utils/dushani-registrationValidation";

const HAZARDS = [
  ["FLOOD", "Flood"],
  ["LANDSLIDE", "Landslide"],
  ["TSUNAMI", "Tsunami"],
  ["CYCLONE", "Cyclone"],
  ["HEAVY_RAIN", "Heavy rain"],
  ["STRONG_WIND", "Strong wind"],
  ["LIGHTNING", "Lightning"],
  ["DROUGHT", "Drought"],
  ["WILDFIRE", "Wildfire"],
  ["COASTAL_EROSION", "Coastal erosion"],
  ["EPIDEMIC", "Epidemic"],
  ["INDUSTRIAL_ACCIDENT", "Industrial accident"],
  ["OTHER", "Something else"],
] as const;

const SEVERITIES = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
] as const;

const HAZARD_LABELS = HAZARDS.map(([, label]) => label);
const SEVERITY_LABELS = SEVERITIES.map(([, label]) => label);

const valueFor = (pairs: readonly (readonly string[])[], label: string) =>
  pairs.find(([, human]) => human === label)?.[0] ?? "";

interface ReportHazardScreenProps {
  token: string;
  homeDistrict?: string | null;
  onBack: () => void;
  onViewReports: () => void;
}

export default function ReportHazardScreen({
  token,
  homeDistrict,
  onBack,
  onViewReports,
}: ReportHazardScreenProps) {
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtsError, setDistrictsError] = useState<string | null>(null);

  const [hazardLabel, setHazardLabel] = useState("");
  const [severityLabel, setSeverityLabel] = useState("");
  const [district, setDistrict] = useState(homeDistrict ?? "");
  const [description, setDescription] = useState("");
  const [population, setPopulation] = useState("");
  const [fix, setFix] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    fetchDistrictNames()
      .then((names) => {
        setDistricts(names);
        setDistrictsError(null);
      })
      .catch((error) =>
        setDistrictsError(
          error instanceof AlertApiError ? error.message : "Districts could not load."
        )
      );
  }, []);

  const change = (field: string, message?: string) => {
    setErrors((current) => {
      const next = { ...current };

      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }

      return next;
    });
  };

  function validate(): boolean {
    const next: FieldErrors = {};

    if (!valueFor(HAZARDS, hazardLabel)) {
      next.hazardType = "Choose the kind of hazard you are seeing.";
    }

    if (!valueFor(SEVERITIES, severityLabel)) {
      next.severityLevel = "Choose how serious it is.";
    }

    if (!district) {
      next.locationDistrict = "Choose the district this is happening in.";
    }

    if (description.trim().length < 15) {
      next.description = "Give the officers at least 15 characters to work with.";
    }

    if (population.trim() && !/^\d+$/.test(population.trim())) {
      next.affectedPopulation = "Use whole numbers, such as 250.";
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  }

  async function useMyLocation() {
    setLocating(true);
    setLocateError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocateError("Location permission was declined. You can still send a report.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});

      setFix({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      // The same fix keeps this phone inside the district audience.
      await saveAlertTarget(token, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).catch(() => undefined);
    } catch {
      setLocateError("Your position could not be read. You can still send a report.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    setRequestError(null);

    if (!validate()) {
      return;
    }

    const payload: NewHazardReport = {
      hazardType: valueFor(HAZARDS, hazardLabel),
      severityLevel: valueFor(SEVERITIES, severityLabel),
      locationDistrict: district,
      description: description.trim(),
      ...(fix ? { locationLat: fix.latitude, locationLng: fix.longitude } : {}),
      ...(population.trim() ? { affectedPopulation: Number(population.trim()) } : {}),
    };

    setSaving(true);

    try {
      const report = await submitHazardReport(token, payload);

      setReference(report.reportId);
    } catch (error) {
      if (error instanceof AlertApiError) {
        setRequestError(error.message);
        setErrors(error.fieldErrors);
      } else {
        setRequestError("The report could not be sent. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (reference) {
    return (
      <FormScreenShell
        title="Report sent"
        subtitle="A DMC officer checks the report before any alert is issued."
        badge={reference}
        onBack={onBack}
      >
        <FormSection>
          <Notice
            tone="info"
            title="Waiting for verification"
            body="You will see the officer's decision on your reports page. A warning is only broadcast after the report is verified."
          />
          <View className="mt-5">
            <Pressable
              onPress={onViewReports}
              accessibilityRole="button"
              className="flex-row items-center justify-center h-14 rounded-xl bg-safeplus-navy active:opacity-85"
            >
              <Text className="text-base font-extrabold text-white">
                See my reports
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" className="ml-2.5" />
            </Pressable>
          </View>
        </FormSection>
      </FormScreenShell>
    );
  }

  return (
    <FormScreenShell
      title="Report a hazard"
      subtitle="Tell the disaster management centre what you can see where you are."
      badge="Ground report"
      onBack={onBack}
    >
      <ErrorSummary count={Object.keys(errors).length} />
      <RequestError message={requestError} />

      {districtsError && <RequestError message={districtsError} />}

      <FormSection title="What is happening" icon="alert-circle-outline">
        <ChoiceField
          label="Hazard"
          value={hazardLabel}
          options={HAZARD_LABELS}
          error={errors.hazardType}
          onChange={(label) => {
            setHazardLabel(label);
            change("hazardType", label ? undefined : "Choose the kind of hazard.");
          }}
        />
        <View className="mt-5">
          <ChoiceField
            label="How serious is it"
            value={severityLabel}
            options={SEVERITY_LABELS}
            error={errors.severityLevel}
            hint="Critical means people need to move now"
            onChange={(label) => {
              setSeverityLabel(label);
              change("severityLevel", label ? undefined : "Choose how serious it is.");
            }}
          />
        </View>
      </FormSection>

      <FormSection
        title="Where"
        caption="Districts follow the same boundaries the officers map."
        icon="location-outline"
      >
        {districts.length > 0 ? (
          <ChoiceField
            label="District"
            value={district}
            options={districts}
            error={errors.locationDistrict}
            onChange={(name) => {
              setDistrict(name);
              change("locationDistrict", name ? undefined : "Choose a district.");
            }}
          />
        ) : (
          <View className="h-14 items-center justify-center">
            {districtsError ? (
              <Text className="text-sm text-safeplus-red">{districtsError}</Text>
            ) : (
              <ActivityIndicator color="#1570EF" />
            )}
          </View>
        )}

        <Pressable
          onPress={() => void useMyLocation()}
          accessibilityRole="button"
          disabled={locating}
          className="flex-row items-center self-start px-4 h-12 mt-5 rounded-xl border border-safeplus-hairline bg-safeplus-fieldBg active:opacity-80 disabled:opacity-60"
        >
          <Ionicons name="navigate-outline" size={18} color="#1570EF" className="mr-2" />
          <Text className="text-sm font-bold text-safeplus-navy">
            {locating
              ? "Reading your position…"
              : fix
                ? "Position attached"
                : "Attach my position (optional)"}
          </Text>
        </Pressable>

        {fix && (
          <Text className="mt-2 text-xs text-safeplus-slate">
            {fix.latitude.toFixed(5)}, {fix.longitude.toFixed(5)} — this also keeps your
            phone in the district alert list.
          </Text>
        )}

        {locateError && <Text className="mt-2 text-xs text-safeplus-red">{locateError}</Text>}
      </FormSection>

      <FormSection title="What you see" icon="chatbox-outline">
        <Field
          label="Description"
          value={description}
          onChange={(value) => {
            setDescription(value);
            change(
              "description",
              value.trim().length >= 15
                ? undefined
                : "Give the officers at least 15 characters to work with."
            );
          }}
          error={errors.description}
          placeholder="Water is rising fast on Lower Kurundu road, about knee deep since 6pm."
          multiline
          autoCapitalize="sentences"
        />
        <View className="mt-5">
          <Field
            label="People affected"
            optional
            value={population}
            onChange={(value) => {
              setPopulation(value);
              change("affectedPopulation", undefined);
            }}
            error={errors.affectedPopulation}
            placeholder="250 (rough estimate is enough)"
            keyboardType="number-pad"
          />
        </View>
      </FormSection>

      <SubmitButton
        onPress={() => void handleSubmit()}
        disabled={saving}
        label={saving ? "Sending…" : "Send report to DMC"}
      />

      <Notice
        tone="info"
        title="Nothing is broadcast yet"
        body="DMC verifies ground reports first, then decides the district, message and channels for a warning."
      />
    </FormScreenShell>
  );
}
