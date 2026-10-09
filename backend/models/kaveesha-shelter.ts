/* ------------------------------------------------------------------ *
 * Shelter Coordination domain types.
 *
 * The three numbers that matter for every shelter are kept distinct on purpose,
 * because collapsing them is exactly what lets two officers overbook one shelter:
 *   confirmed_occupancy     people physically inside, changed only on confirmation
 *   pending_arrivals        reserved by a PENDING allocation, not arrived yet
 *   remaining_allocatable   space a new allocation may actually claim right now
 * ------------------------------------------------------------------ */

export type ShelterBand = "AVAILABLE" | "LIMITED" | "FULL";

/**
 * The four-band health reading the dashboards group shelters under. Stricter
 * than the two-tone band: it answers "how close is this shelter to full?" for a
 * room that still has space, so the desk can see stable houses apart from calm
 * ones. Ordered most urgent first.
 */
export type ShelterStatus = "CRITICAL" | "WARNING" | "STABLE" | "AVAILABLE";

/** One point of the reconstructed 24h confirmed-occupancy line. */
export interface OccupancyTrendPoint {
  hour: string;
  occupancy: number;
}

/** One shelter's analytics row: roll + status + the managers who run it. */
export interface ShelterAnalyticsRow extends ShelterRoll {
  status: ShelterStatus;
  managers: { id: string; fullName: string; email?: string; phone?: string }[];
}

/** Everything a shelter dashboard draws above the board. */
export interface ShelterAnalytics {
  district: string | null;
  districts: string[];
  generatedAt: string;
  totalBeds: number;
  occupiedBeds: number;
  reservedBeds: number;
  freeBeds: number;
  totalOccupancy: number;
  trend: OccupancyTrendPoint[];
  perShelterTrend: Record<string, OccupancyTrendPoint[]>;
  shelters: ShelterAnalyticsRow[];
}

export type EvacueeArrivalSource = "SELF" | "RESCUE_TEAM";

export type EvacueeGroupStatus =
  | "AWAITING_SHELTER"
  | "ALLOCATED"
  | "IN_TRANSIT"
  | "ARRIVAL_REPORTED"
  | "ARRIVED"
  | "PARTIAL"
  | "CANCELLED";

export type AllocationStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type ShelterEventKind =
  | "WALK_IN"
  | "ARRIVAL_CONFIRMED"
  | "DEPARTURE"
  | "ADJUSTMENT"
  | "ALLOCATED"
  | "CANCELLED";

/** A shelter with its live capacity trio computed, and distance when searched. */
export interface ShelterRoll {
  id: string;
  shelterCode: string;
  name: string;
  district: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  confirmedOccupancy: number;
  pendingArrivals: number;
  remainingAllocatable: number;
  isActive: boolean;
  facilities: string[];
  /** Set only when the caller searched from a point. */
  distanceKm?: number;
  createdAt: string;
  updatedAt: string;
}

/** One line of a group's split across shelters. */
export interface ShelterAllocation {
  id: string;
  groupId: string;
  shelterId: string;
  shelterCode: string;
  shelterName: string;
  allocatedCount: number;
  arrivedCount: number;
  status: AllocationStatus;
  allocatedByName?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  discrepancyNote?: string;
  createdAt: string;
  updatedAt: string;
}

/** The unit of allocation: people who need shelter together. */
export interface EvacueeGroup {
  id: string;
  groupCode: string;
  peopleCount: number;
  vulnerableCount: number;
  arrivalSource: EvacueeArrivalSource;
  district: string;
  originLatitude?: number;
  originLongitude?: number;
  sourceDispatchId?: string;
  incidentReportId?: string;
  status: EvacueeGroupStatus;
  /** Where each part of this group has been sent. */
  allocations: ShelterAllocation[];
  createdAt: string;
  updatedAt: string;
}

/** One append-only ledger line. */
export interface ShelterEvent {
  id: string;
  shelterId: string;
  groupId?: string;
  kind: ShelterEventKind;
  peopleDelta: number;
  note?: string;
  actorName?: string;
  actorRole?: string;
  createdAt: string;
}

/** The shelter-side identity of a Shelter Manager account. */
export interface ShelterManager {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  designation?: string;
  district: string;
  status: "ACTIVE" | "SUSPENDED";
  shelterIds: string[];
  shelters: { id: string; shelterCode: string; name: string }[];
  createdAt: string;
}
