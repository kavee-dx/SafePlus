import type { LucideIcon } from "lucide-react";
import {
  Ambulance,
  Anchor,
  BriefcaseMedical,
  Building2,
  Compass,
  Cross,
  Drone,
  Flame,
  Flashlight,
  HeartPulse,
  LifeBuoy,
  Moon,
  Mountain,
  Radio,
  Search,
  Ship,
  ShieldCheck,
  TriangleAlert,
  Users,
  Waves,
} from "lucide-react";

import type { Validator } from "../utils/dushani-registrationValidation";

/* ------------------------------------------------------------------ *
 * Rescue team options and validation rules.
 *
 * These lists are kept in step with the backend rescue team constants.
 * They live outside the component file so the shared field components
 * only export components (hot reload stays reliable).
 * ------------------------------------------------------------------ */

export const TEAM_TYPES = [
  "Flood Rescue",
  "Water Rescue",
  "Landslide Rescue",
  "Search & Rescue",
  "Fire & Rescue",
  "Medical Rescue",
  "Urban Search & Rescue",
  "Multi-Hazard Rescue",
  "Other",
] as const;

export const TEAM_CAPABILITIES = [
  "Flood Rescue",
  "Water Rescue",
  "Landslide Rescue",
  "Search & Rescue",
  "Medical / First Aid",
  "Evacuation",
  "Fire Rescue",
  "Night Operations",
] as const;

export const TEAM_EQUIPMENT = [
  "Rescue Boat",
  "Life Jackets",
  "Ropes",
  "First Aid Kit",
  "Radio",
  "Rescue Vehicle",
  "Search Lights",
  "Drone",
] as const;

const TYPE_ICONS: Record<string, LucideIcon> = {
  "Flood Rescue": Waves,
  "Water Rescue": Anchor,
  "Landslide Rescue": Mountain,
  "Search & Rescue": Search,
  "Fire & Rescue": Flame,
  "Medical Rescue": HeartPulse,
  "Urban Search & Rescue": Building2,
  "Multi-Hazard Rescue": TriangleAlert,
  Other: Compass,
};

export const CAPABILITY_ICONS: Record<string, LucideIcon> = {
  "Flood Rescue": Waves,
  "Water Rescue": Anchor,
  "Landslide Rescue": Mountain,
  "Search & Rescue": Search,
  "Medical / First Aid": BriefcaseMedical,
  Evacuation: Users,
  "Fire Rescue": Flame,
  "Night Operations": Moon,
};

export const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  "Rescue Boat": Ship,
  "Life Jackets": LifeBuoy,
  Ropes: Cross,
  "First Aid Kit": BriefcaseMedical,
  Radio: Radio,
  "Rescue Vehicle": Ambulance,
  "Search Lights": Flashlight,
  Drone: Drone,
};

/**
 * Look-up used wherever a team's discipline is displayed, so the registration
 * form, the leader dashboard and the review queues all show the same icon.
 */
export function teamTypeIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? ShieldCheck;
}

export interface VerifiedOrganization {
  name: string;
  type: string;
  registrationId: string;
  district: string;
}

/* ------------------------------------------------------------------ *
 * Validation helpers mirrored from the backend team rules.
 * ------------------------------------------------------------------ */

const NIC_REGEX = /^(?:\d{9}[vVxX]|\d{12})$/;

const SRILANKA_LAT_RANGE: [number, number] = [5.85, 10.55];
const SRILANKA_LNG_RANGE: [number, number] = [79.6, 82.0];

export const nicRule: Validator = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return "NIC / official ID is required.";
  if (!NIC_REGEX.test(v)) {
    return "NIC must be 9 digits followed by V or X, or 12 digits.";
  }
  return null;
};

export function oneOfRule(label: string, allowed: readonly string[]): Validator {
  return (value) => {
    const v = String(value ?? "").trim();
    if (!v) return `${label} is required.`;
    if (!allowed.includes(v)) return `${label} is not a supported option.`;
    return null;
  };
}

export function toList(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function listRule(
  label: string,
  allowed: readonly string[],
  minSelections = 0
): Validator {
  return (value) => {
    const picked = toList(value);

    if (picked.length < minSelections) {
      return minSelections === 1
        ? `Select at least one ${label.toLowerCase()}.`
        : `${label} needs at least ${minSelections} selections.`;
    }

    const unknown = picked.find((item) => !allowed.includes(item));
    if (unknown) return `${unknown} is not a supported ${label.toLowerCase()}.`;

    return null;
  };
}

export function optionalListRule(
  label: string,
  allowed: readonly string[]
): Validator {
  return (value) => {
    const picked = toList(value);
    if (picked.length === 0) return null;

    const unknown = picked.find((item) => !allowed.includes(item));
    if (unknown) return `${unknown} is not a supported ${label.toLowerCase()}.`;

    return null;
  };
}

function coordRule(label: string, value: string, range: [number, number]): string | null {
  const v = String(value ?? "").trim();
  if (!v) return `${label} is required. Pick the base location on the map.`;

  const parsed = Number(v);
  if (!Number.isFinite(parsed)) return `${label} must be a number.`;
  if (parsed < range[0] || parsed > range[1]) {
    return `${label} must be inside Sri Lanka.`;
  }
  return null;
}

export const latitudeRule: Validator = (value) =>
  coordRule("Base latitude", value, SRILANKA_LAT_RANGE);

export const longitudeRule: Validator = (value) =>
  coordRule("Base longitude", value, SRILANKA_LNG_RANGE);
