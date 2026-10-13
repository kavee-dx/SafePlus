import axios, { type AxiosRequestConfig } from "axios";

/* ------------------------------------------------------------------ *
 * The team leader's own board, on the phone (UC-03, mobile).
 *
 * A leader never decides which team they are or which district they belong to —
 * the server resolves both from the login token, exactly as it does for the DMC
 * portal. This file only moves the leader's single live mission forward and reads
 * their team's standing state. Nothing here can reach another team's work.
 * ------------------------------------------------------------------ */

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "http://localhost:5000/api";

export type DispatchStatus =
  | "DISPATCHED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "RESCUE_IN_PROGRESS"
  | "RETURNING"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

export class LeaderApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "LeaderApiError";
  }
}

export interface DispatchEvent {
  id: string;
  fromStatus: DispatchStatus | null;
  toStatus: DispatchStatus;
  actorRole?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

/** One shelter the district has allocated to this mission's group. The largest
 *  allocation drives the map; a split shows the rest as a secondary navigate. */
export interface ShelterAssignment {
  shelterId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  allocatedCount: number;
}

/** One mission as the leader sees it. The scene facts ride along so the phone
 *  can show where to go without a second request. */
export interface MissionRoll {
  id: string;
  dispatchCode: string;
  status: DispatchStatus;
  district: string;
  missionNotes?: string | null;
  peopleRescued?: number | null;
  peopleEvacuated?: number | null;
  declineReason?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  teamName: string;
  memberCount: number;
  leaderFullName: string;
  leaderPhone: string;
  baseLatitude?: number | null;
  baseLongitude?: number | null;
  baseLocationLabel?: string | null;
  reportPublicId: string;
  hazardType: string;
  severityLevel: string;
  landmark?: string | null;
  incidentLat?: number | null;
  incidentLng?: number | null;
  affectedPopulation?: number | null;
  immediateDanger?: boolean | null;
  dispatchedByName?: string | null;
  controlPhone?: string | null;
  /** The incident's first photo as a stored data URL, present on the live mission. */
  thumbnailUrl?: string | null;
  /** Shelters the district allocated to this mission's group, once assigned. */
  shelterAssignment?: ShelterAssignment[];
  /** The evacuee group's status (AWAITING_SHELTER/ALLOCATED/IN_TRANSIT/...), if any. */
  groupStatus?: string | null;
  events: DispatchEvent[];
}

export interface LeaderWorkspace {
  team: { id: string; name: string; availability: string };
  active: MissionRoll | null;
  history: MissionRoll[];
  /** The stages this mission may legally move to next — the server's answer,
   *  so the phone never keeps its own copy of the machine. */
  nextStatuses: DispatchStatus[];
}

export interface TeamDashboard {
  team: {
    name: string;
    type: string;
    size: number;
    district: string;
    contactNumber: string;
    capabilities: string[];
    equipment: string[];
    base: { latitude: number | null; longitude: number | null; label: string | null };
    availability: string;
    affiliation: string;
  };
  leader: {
    fullName: string;
    designation: string | null;
    email: string;
    phone: string;
  };
  organization: { name: string; registrationId: string } | null;
  account: { status: string; rejectionReason: string | null; verifiedAt: string | null };
}

function request(token: string, extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  return {
    ...extra,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(extra.headers ?? {}),
    },
  };
}

function toError(error: unknown): LeaderApiError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return new LeaderApiError(
        "Cannot reach SafePlus. Check your connection and try again.",
        null
      );
    }

    const body = error.response.data as { message?: string };

    return new LeaderApiError(
      body?.message ?? "The request could not be completed.",
      error.response.status
    );
  }

  return new LeaderApiError(
    error instanceof Error ? error.message : "Unexpected error.",
    null
  );
}

/** The leader's live mission, their history, and the stages they can move to. */
export async function fetchMyWorkspace(token: string): Promise<LeaderWorkspace> {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/rescue-dispatch/mine`,
      request(token)
    );

    return {
      team: data.team,
      active: data.active ?? null,
      history: data.history ?? [],
      nextStatuses: data.nextStatuses ?? [],
    } as LeaderWorkspace;
  } catch (error) {
    throw toError(error);
  }
}

export interface StageUpdate {
  status: DispatchStatus;
  note?: string;
  peopleRescued?: number;
  peopleEvacuated?: number;
}

/**
 * Move the leader's own mission forward. The reference is "current" on purpose:
 * the team holds at most one live mission, so the server resolves it from the
 * login and a leader never has to know a dispatch id.
 */
export async function advanceStage(
  token: string,
  update: StageUpdate
): Promise<MissionRoll> {
  try {
    const { data } = await axios.post(
      `${BASE_URL}/rescue-dispatch/dispatches/current/status`,
      update,
      request(token)
    );

    return data.dispatch as MissionRoll;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The leader's "we reached the shelter" tap. It flags the mission's evacuee
 * group as ARRIVAL_REPORTED so the shelter desk knows people are at the door —
 * the Shelter Manager still confirms the headcount before occupancy rises. As
 * with the stage moves, "current" is resolved from the login, so a leader never
 * needs to know a dispatch id.
 */
export async function reportShelterArrival(
  token: string,
  dispatchId?: string
): Promise<string> {
  const reference = dispatchId && dispatchId.trim() !== "" ? dispatchId.trim() : "current";

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rescue-dispatch/dispatches/${encodeURIComponent(reference)}/shelter-arrival`,
      {},
      request(token)
    );

    return (data?.message ?? "Arrival reported.") as string;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The leader's "accept, heading to shelter" tap. It moves the mission's evacuee
 * group from ALLOCATED to IN_TRANSIT so the district and the shelter desk know
 * the team is moving. After a mission completes there is no live dispatch, so the
 * phone passes the real mission id the workspace handed back; when omitted the
 * server falls back to "current" resolved from the login.
 */
export async function ackShelterAssignment(
  token: string,
  dispatchId?: string
): Promise<string> {
  const reference = dispatchId && dispatchId.trim() !== "" ? dispatchId.trim() : "current";

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rescue-dispatch/dispatches/${encodeURIComponent(reference)}/shelter-ack`,
      {},
      request(token)
    );

    return (data?.message ?? "Shelter plan accepted.") as string;
  } catch (error) {
    throw toError(error);
  }
}

/**
 * The leader declines the shelter the district assigned — those beds do not work
 * for the people they are bringing back. It releases the reservation and hands the
 * group back to the district to reassign; the mission itself keeps running.
 */
export async function rejectShelterAssignment(
  token: string,
  dispatchId?: string
): Promise<string> {
  const reference = dispatchId && dispatchId.trim() !== "" ? dispatchId.trim() : "current";

  try {
    const { data } = await axios.post(
      `${BASE_URL}/rescue-dispatch/dispatches/${encodeURIComponent(reference)}/shelter-reject`,
      {},
      request(token)
    );

    return (data?.message ?? "Shelter plan declined.") as string;
  } catch (error) {
    throw toError(error);
  }
}

/** The team's standing profile and its availability switch. */
export async function fetchTeamDashboard(token: string): Promise<TeamDashboard> {
  try {
    const { data } = await axios.get(
      `${BASE_URL}/rescue-teams/dashboard`,
      request(token)
    );

    return data.data as TeamDashboard;
  } catch (error) {
    throw toError(error);
  }
}

/* ------------------------------------------------------------------ *
 * The leader's standing messages — the taskings and stand-downs that landed on
 * the phone. The push is a banner that fades; this feed is read back from the
 * server so nothing is lost while the handset had no signal. It rides the same
 * user-scoped notifications endpoint the portal bell uses, and the server
 * filters it to whoever the login belongs to — a leader never sees another's.
 * ------------------------------------------------------------------ */

export interface LeaderNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedReportId?: string | null;
}

export interface LeaderNotificationFeed {
  items: LeaderNotification[];
  unreadCount: number;
}

/** Newest first, with the unread count the header badge shows. */
export async function fetchMyNotifications(
  token: string
): Promise<LeaderNotificationFeed> {
  try {
    const { data } = await axios.get(`${BASE_URL}/notifications`, request(token));

    const raw = (data?.notifications ?? []) as Record<string, unknown>[];

    return {
      items: raw.map((row) => ({
        id: String(row.id),
        type: String(row.type ?? ""),
        title: String(row.title ?? ""),
        message: String(row.message ?? ""),
        isRead: Boolean(row.isRead),
        createdAt: String(row.createdAt ?? ""),
        relatedReportId:
          row.relatedReportId === null || row.relatedReportId === undefined
            ? null
            : String(row.relatedReportId),
      })),
      unreadCount: Number(data?.unreadCount ?? 0),
    };
  } catch (error) {
    throw toError(error);
  }
}

/** Mark one message read. The server scopes it to the login, so an id from
 *  another account simply no-ops there. */
export async function markNotificationRead(
  token: string,
  notificationId: string
): Promise<void> {
  try {
    await axios.put(
      `${BASE_URL}/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
      request(token)
    );
  } catch (error) {
    throw toError(error);
  }
}

export type AvailabilityState = "AVAILABLE" | "ON_DEPLOYMENT" | "UNAVAILABLE";

/** Say whether the team can be tasked. Only these three states are accepted. */
export async function updateAvailability(
  token: string,
  availability: AvailabilityState
): Promise<TeamDashboard> {
  try {
    const { data } = await axios.put(
      `${BASE_URL}/rescue-teams/availability`,
      { availability },
      request(token)
    );

    return data.data as TeamDashboard;
  } catch (error) {
    throw toError(error);
  }
}

/* ------------------------------------------------------------------ *
 * Stage language for the phone. The order and the allowed moves come from the
 * server; this only says each stage in a way a leader in the rain can read at a
 * glance, and picks the one colour that carries the meaning.
 * ------------------------------------------------------------------ */

export interface StageMeta {
  label: string;
  /** A short line under the button, so the action is unmistakable. */
  hint: string;
  /** Whether this stage takes the head-count numbers. */
  needsCounts: boolean;
}

export const STAGE_LABELS: Record<DispatchStatus, string> = {
  DISPATCHED: "Tasked",
  ACCEPTED: "Accepted",
  EN_ROUTE: "On the way",
  ARRIVED: "On scene",
  RESCUE_IN_PROGRESS: "Rescue running",
  RETURNING: "Coming back",
  COMPLETED: "Finished",
  DECLINED: "Declined",
  CANCELLED: "Stood down",
};

export const STAGE_ACTIONS: Record<string, StageMeta> = {
  ACCEPTED: {
    label: "Accept the tasking",
    hint: "You have taken the job and are getting moving.",
    needsCounts: false,
  },
  DECLINED: {
    label: "Decline",
    hint: "You cannot take this mission — say why, if you can.",
    needsCounts: false,
  },
  EN_ROUTE: {
    label: "We are on the way",
    hint: "The team is moving toward the scene.",
    needsCounts: false,
  },
  ARRIVED: {
    label: "We have arrived",
    hint: "The team is at the incident location.",
    needsCounts: false,
  },
  RESCUE_IN_PROGRESS: {
    label: "Rescue under way",
    hint: "Work has started on the ground.",
    needsCounts: false,
  },
  RETURNING: {
    label: "Returning",
    hint: "On the way back — enter how many you rescued and evacuated, so the district can find shelters for them now.",
    needsCounts: true,
  },
  COMPLETED: {
    label: "Mission complete",
    hint: "Everyone is settled. Finish the mission and it moves to your history.",
    needsCounts: false,
  },
};

export const LIVE_STATUSES: DispatchStatus[] = [
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
];

export function isLiveStatus(status: DispatchStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

/**
 * A stage's colour as a hex, chosen so a glance reads urgency without a word.
 * Kept here rather than in the view so the pill and the timeline agree.
 */
export function stageColor(status: DispatchStatus): string {
  switch (status) {
    case "DISPATCHED":
      return "#F79009";
    case "ACCEPTED":
      return "#1570EF";
    case "EN_ROUTE":
      return "#1570EF";
    case "ARRIVED":
      return "#7C3AED";
    case "RESCUE_IN_PROGRESS":
      return "#D92D20";
    case "RETURNING":
      return "#0EA5E9";
    case "COMPLETED":
      return "#16A34A";
    case "DECLINED":
      return "#98A2B3";
    case "CANCELLED":
      return "#98A2B3";
    default:
      return "#667085";
  }
}

/** Whole minutes from an ISO stamp to now, clamped at zero. */
export function minutesSince(value: string | null | undefined): number {
  if (!value) return 0;

  const at = new Date(value).getTime();

  if (!Number.isFinite(at)) return 0;

  return Math.max(0, Math.round((Date.now() - at) / 60000));
}
