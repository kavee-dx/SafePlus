import type { FieldErrors } from "./dushani-registrationValidation";
import type { DetailedReportPayload, EvidenceInput } from "../services/amasha-reportApi";

export const HAZARDS = [
  ["FLOOD", "Flood"],
  ["LANDSLIDE", "Landslide"],
  ["WILDFIRE", "Fire"],
  ["CYCLONE", "Cyclone"],
  ["DROUGHT", "Drought"],
  ["TSUNAMI", "Tsunami"],
  ["HEAVY_RAIN", "Heavy rain"],
  ["STRONG_WIND", "Strong wind"],
  ["LIGHTNING", "Lightning"],
  ["COASTAL_EROSION", "Coastal erosion"],
  ["EPIDEMIC", "Epidemic"],
  ["INDUSTRIAL_ACCIDENT", "Industrial accident"],
  ["OTHER", "Something else"],
] as const;

export const SEVERITIES = [
  ["LOW", "Low"],
  ["MEDIUM", "Medium"],
  ["HIGH", "High"],
  ["CRITICAL", "Critical"],
] as const;

export const STEPS = [
  "Incident type",
  "Details",
  "Evidence",
  "Location",
  "Preview",
] as const;

export type ReportStep = 0 | 1 | 2 | 3 | 4;

export const HAZARD_LABELS = HAZARDS.map(([, label]) => label);
export const SEVERITY_LABELS = SEVERITIES.map(([, label]) => label);

export function valueFor(
  pairs: readonly (readonly string[])[],
  label: string
): string {
  return pairs.find(([, human]) => human === label)?.[0] ?? "";
}

export function labelFor(pairs: readonly (readonly string[])[], value: string): string {
  return pairs.find(([code]) => code === value)?.[1] ?? value;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateParts(date = new Date()): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function toObservedIso(date: string, time: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const clock = /^(\d{2}):(\d{2})$/.exec(time.trim());

  if (!match || !clock) {
    return null;
  }

  const observed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(clock[1]),
    Number(clock[2]),
    0
  );

  if (Number.isNaN(observed.getTime())) {
    return null;
  }

  return observed.toISOString();
}

export interface ReportDraft {
  hazardLabel: string;
  severityLabel: string;
  district: string;
  description: string;
  landmark: string;
  population: string;
  immediateDanger: boolean;
  observedDate: string;
  observedTime: string;
  latitude?: number;
  longitude?: number;
  attachments: EvidenceInput[];
}

export function emptyDraft(homeDistrict?: string | null): ReportDraft {
  const now = localDateParts();

  return {
    hazardLabel: "",
    severityLabel: "",
    district: homeDistrict ?? "",
    description: "",
    landmark: "",
    population: "",
    immediateDanger: false,
    observedDate: now.date,
    observedTime: now.time,
    attachments: [],
  };
}

export function draftFromPayload(
  payload: {
    hazardType: string;
    severityLevel: string;
    locationDistrict: string;
    description: string;
    landmark?: string;
    affectedPopulation?: number;
    immediateDanger: boolean;
    observedAt?: string;
    locationLat?: number;
    locationLng?: number;
  },
  existingAttachments: EvidenceInput[] = []
): ReportDraft {
  const observed = payload.observedAt ? new Date(payload.observedAt) : new Date();
  const parts = Number.isNaN(observed.getTime())
    ? localDateParts()
    : localDateParts(observed);

  return {
    hazardLabel: labelFor(HAZARDS, payload.hazardType),
    severityLabel: labelFor(SEVERITIES, payload.severityLevel),
    district: payload.locationDistrict,
    description: payload.description,
    landmark: payload.landmark ?? "",
    population:
      payload.affectedPopulation !== undefined
        ? String(payload.affectedPopulation)
        : "",
    immediateDanger: payload.immediateDanger,
    observedDate: parts.date,
    observedTime: parts.time,
    latitude: payload.locationLat,
    longitude: payload.locationLng,
    attachments: existingAttachments,
  };
}

export function validateStep(step: ReportStep, draft: ReportDraft): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 0) {
    if (!valueFor(HAZARDS, draft.hazardLabel)) {
      errors.hazardType = "Choose the kind of incident you are seeing.";
    }

    if (!valueFor(SEVERITIES, draft.severityLabel)) {
      errors.severityLevel = "Choose how urgent this is.";
    }
  }

  if (step === 1) {
    if (draft.description.trim().length < 15) {
      errors.description = "Give at least 15 characters so officers can act.";
    }

    const iso = toObservedIso(draft.observedDate, draft.observedTime);

    if (!iso) {
      errors.observedAt = "Enter when you observed this (date and time).";
    } else if (new Date(iso).getTime() > Date.now() + 5 * 60 * 1000) {
      errors.observedAt = "The observed time cannot be in the future.";
    }

    if (draft.population.trim() && !/^\d+$/.test(draft.population.trim())) {
      errors.affectedPopulation = "Use a whole number, such as 250.";
    }
  }

  if (step === 3) {
    if (!draft.district.trim()) {
      errors.locationDistrict = "Choose the district this is happening in.";
    }

    if (draft.latitude === undefined || draft.longitude === undefined) {
      errors.locationLat = "Capture GPS or enter coordinates for the incident.";
    }
  }

  return errors;
}

export function toPayload(
  draft: ReportDraft
): { payload: DetailedReportPayload } | { errors: FieldErrors } {
  const errors: FieldErrors = {
    ...validateStep(0, draft),
    ...validateStep(1, draft),
    ...validateStep(3, draft),
  };

  const iso = toObservedIso(draft.observedDate, draft.observedTime);

  if (!iso && !errors.observedAt) {
    errors.observedAt = "Enter when you observed this (date and time).";
  }

  if (Object.keys(errors).length > 0 || !iso) {
    return { errors };
  }

  return {
    payload: {
      hazardType: valueFor(HAZARDS, draft.hazardLabel),
      severityLevel: valueFor(SEVERITIES, draft.severityLabel),
      locationDistrict: draft.district,
      description: draft.description.trim(),
      observedAt: iso,
      locationLat: draft.latitude,
      locationLng: draft.longitude,
      ...(draft.landmark.trim() ? { landmark: draft.landmark.trim() } : {}),
      ...(draft.population.trim()
        ? { affectedPopulation: Number(draft.population.trim()) }
        : {}),
      immediateDanger: draft.immediateDanger,
      ...(draft.attachments.length > 0 ? { attachments: draft.attachments } : {}),
    },
  };
}
