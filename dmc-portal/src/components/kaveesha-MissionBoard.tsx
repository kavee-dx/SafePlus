import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Ban,
  Car,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Flag,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type DispatchRoll,
  type DispatchStatus,
} from "../services/kaveesha-dispatchApi";
import {
  type EvacueeGroup,
  type ShelterRoll,
  fetchShelters,
  fetchShelterGroupForDispatch,
  requestShelterForDispatch,
} from "../services/kaveesha-shelterApi";
import { AllocationEditor } from "./kaveesha-ShelterAllocation";
import { groupStatusMeta } from "../utils/kaveesha-shelterFormat";
import { DISPATCH_CSS, DESK_CSS } from "../styles/kaveesha-dispatchStyles";
import {
  clockTime,
  formatDateTime,
  humanizeHazard,
  isLiveStage,
  relativeTime,
  stageMeta,
} from "../utils/kaveesha-dispatchFormat";

/* ------------------------------------------------------------------ *
 * One mission, as the district reads it.
 *
 * The card is shared by the incident response page (where live missions sit
 * straight under the map) and by any later list of them: the stage trail, the
 * brief the team was given, the outcome it reported and the leader's number.
 * An officer may stand a live mission down; only the team can complete it.
 * ------------------------------------------------------------------ */

const STAGE_ORDER: DispatchStatus[] = [
  "DISPATCHED",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
  "COMPLETED",
];

const STAGE_ICONS: Record<string, LucideIcon> = {
  DISPATCHED: ClipboardList,
  ACCEPTED: CheckCircle2,
  EN_ROUTE: Navigation,
  ARRIVED: MapPin,
  RESCUE_IN_PROGRESS: ShieldAlert,
  RETURNING: Route,
  COMPLETED: Flag,
  DECLINED: Ban,
  CANCELLED: Ban,
};

/**
 * A mission can raise a shelter need once the team is on scene with people, and
 * it stays open through the close so a late or pre-completion allocation is
 * possible. Missions that ended before the site (DECLINED/CANCELLED) are excluded.
 */
const SHELTER_ELIGIBLE: DispatchStatus[] = [
  "ARRIVED",
  "RESCUE_IN_PROGRESS",
  "RETURNING",
  "COMPLETED",
];

/* ------------------------------------------------------------------ *
 * The live shelter handoff, read back from the mission's evacuee group.
 *
 * The officer allocates on the card, then the action moves to the leader's
 * phone: they accept and drive (IN_TRANSIT) or decline (DECLINED). This strip is
 * how the officer sees that response without leaving the board, and how a
 * declined plan surfaces as "reassign" rather than silently sitting reserved.
 * ------------------------------------------------------------------ */

function officerHandoffCopy(group: EvacueeGroup): {
  tone: string;
  headline: string;
  detail: string;
} {
  switch (group.status) {
    case "AWAITING_SHELTER":
      return {
        tone: "#F79009",
        headline: "Needs a shelter",
        detail: `${group.peopleCount} people are waiting for beds — reserve nearby shelters that still have space.`,
      };
    case "ALLOCATED":
      return {
        tone: "#2E90FA",
        headline: "Reserved — waiting for the team to accept",
        detail: "The leader has been told where to drive. This updates the moment they accept on their phone.",
      };
    case "IN_TRANSIT":
      return {
        tone: "#2E90FA",
        headline: "Team accepted — driving to the shelter",
        detail: "The people are on the way to the beds below.",
      };
    case "ARRIVAL_REPORTED":
      return {
        tone: "#2E90FA",
        headline: "Arrived — the shelter manager is confirming the headcount",
        detail: "Occupancy rises once the manager confirms who actually came in.",
      };
    case "ARRIVED":
      return {
        tone: "#12B76A",
        headline: "Everyone checked in at the shelter",
        detail: "The group from this mission is settled.",
      };
    case "PARTIAL":
      return {
        tone: "#F79009",
        headline: "Partly arrived — some are still unaccounted",
        detail: "Part of the group checked in; the rest has not been confirmed at the shelter.",
      };
    case "DECLINED":
      return {
        tone: "#F04438",
        headline: "Team declined this shelter",
        detail: "Those beds did not work for the group. Reassign them to shelters that still have space.",
      };
    case "CANCELLED":
      return {
        tone: "#98A2B3",
        headline: "Allocation stood down",
        detail: "The reservations for this group were cancelled.",
      };
    default:
      return {
        tone: "#98A2B3",
        headline: (group.status as string).replace(/_/g, " ").toLowerCase(),
        detail: "",
      };
  }
}

function ShelterHandoffView({ group }: { group: EvacueeGroup }) {
  const copy = officerHandoffCopy(group);
  const status = groupStatusMeta(group.status);
  const beds = group.allocations.filter((a) => a.status !== "CANCELLED");

  return (
    <div
      style={{
        border: `1px solid ${copy.tone}33`,
        background: `${copy.tone}0D`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {group.status === "IN_TRANSIT" ? (
          <Car size={16} color={copy.tone} />
        ) : (
          <Warehouse size={16} color={copy.tone} />
        )}
        <span style={{ fontWeight: 900, color: copy.tone, fontSize: 13.5 }}>
          {copy.headline}
        </span>
        <span
          className={`kdx-chip ${status.chip}`}
          style={{ marginLeft: "auto" }}
        >
          {status.label}
        </span>
      </div>

      {copy.detail && (
        <span className="kdx-muted-line" style={{ fontSize: 12.5 }}>
          {copy.detail}
        </span>
      )}

      {beds.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {beds.map((allocation) => (
            <div
              key={allocation.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
                color: Colors.navy,
              }}
            >
              <MapPin size={12} />
              {allocation.shelterName} · {allocation.allocatedCount} placed
              {allocation.status === "CONFIRMED" && allocation.arrivedCount > 0
                ? ` · ${allocation.arrivedCount} checked in`
                : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shelterButtonLabel(handoff: EvacueeGroup | null): string {
  switch (handoff?.status) {
    case "DECLINED":
      return "Reassign shelter";
    case "ALLOCATED":
      return "View / re-plan shelter";
    case "IN_TRANSIT":
      return "Shelter in progress";
    case "ARRIVAL_REPORTED":
      return "Confirming arrival";
    case "ARRIVED":
      return "Shelter settled";
    case "PARTIAL":
      return "Shelter partial";
    default:
      return "Allocate shelter";
  }
}

function shelterButtonColor(handoff: EvacueeGroup | null): string {
  if (!handoff) return "#12B76A";
  if (handoff.status === "DECLINED") return "#F79009";
  if (handoff.status === "AWAITING_SHELTER" || handoff.status === "CANCELLED") {
    return "#12B76A";
  }
  return "#2E90FA";
}

function shelterButtonHint(handoff: EvacueeGroup | null, district: string): string {
  if (!handoff) {
    return `The team is bringing people back — place them in the best nearby shelters in ${district} that still have space.`;
  }
  switch (handoff.status) {
    case "DECLINED":
      return "The team could not use those beds. Open this again to reassign them to shelters that still have space.";
    case "ALLOCATED":
      return `Beds are reserved for ${handoff.peopleCount} people. The leader accepts or declines on their phone; this card follows.`;
    case "IN_TRANSIT":
      return "The team accepted the plan and is driving the people to the shelter now.";
    case "ARRIVAL_REPORTED":
      return "The team has arrived; the shelter manager is confirming the headcount.";
    case "ARRIVED":
      return "Everyone from this mission is checked in at the shelter.";
    default:
      return `Open the desk to place or adjust this group's beds in ${district}.`;
  }
}

export function MissionCard({
  roll,
  showIncident = true,
  busy = false,
  token,
  district,
  onStandDown,
  onOpenIncident,
}: {
  roll: DispatchRoll;
  showIncident?: boolean;
  busy?: boolean;
  /** The officer's token, so the card can open the shelter desk on real data. */
  token?: string;
  /** The officer's own district, a fallback when the mission carries none. */
  district?: string;
  onStandDown?: (roll: DispatchRoll, reason: string) => void;
  onOpenIncident?: (reportPublicId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [shelterOpen, setShelterOpen] = useState(false);
  const [handoff, setHandoff] = useState<EvacueeGroup | null>(null);

  const stage = stageMeta(roll.status);
  const Icon = STAGE_ICONS[roll.status] ?? ClipboardList;
  const reachedIndex = STAGE_ORDER.indexOf(roll.status);
  const closed = reachedIndex === -1;
  const canShelter = !!token && SHELTER_ELIGIBLE.includes(roll.status);

  // The mission's live shelter handoff, read straight from the group the officer
  // and leader are acting on. Nothing is cached on the card itself, so what the
  // officer sees is the real evacuee_groups row, never a stale copy.
  const refreshHandoff = useCallback(() => {
    if (!token) return;

    fetchShelterGroupForDispatch(token, roll.id)
      .then(setHandoff)
      .catch(() => {
        /* A transient read miss keeps whatever was last known on screen. */
      });
  }, [token, roll.id]);

  // Keep the card honest while the leader still owes a response (accepted, is
  // driving, declined) — a leader's tap lands on their own phone, not this board,
  // so the officer learns of it by re-reading the group. Once the group is settled
  // (arrived / cancelled) the polling stops.
  const handoffPending =
    !!handoff &&
    handoff.status !== "ARRIVED" &&
    handoff.status !== "CANCELLED";

  useEffect(() => {
    if (!canShelter || !token) return;

    let cancelled = false;

    fetchShelterGroupForDispatch(token, roll.id)
      .then((group) => {
        if (!cancelled) setHandoff(group);
      })
      .catch(() => undefined);

    if (!handoffPending) {
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setInterval(refreshHandoff, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canShelter, token, roll.id, handoffPending, refreshHandoff]);

  return (
    <>
    <article className={`kdx-mission ${isLiveStage(roll.status) ? "kdx-mission-live" : ""}`}>
      <div className="kdx-mission-top">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span className="kdx-mission-code">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: stage.color,
                display: "inline-block",
              }}
            />
            {roll.dispatchCode}
            <span className="kdx-chip" style={{ marginLeft: 4 }}>
              {roll.district}
            </span>
          </span>

          <span style={{ fontSize: 13.5, fontWeight: 800, color: Colors.navy }}>
            {roll.teamName}
            {roll.teamType ? <span className="kdx-team-type">{roll.teamType}</span> : null}
          </span>

          <span className="kdx-muted-line">
            {roll.leaderFullName} · {roll.memberCount} members · tasked{" "}
            {relativeTime(roll.createdAt)}
          </span>

          {/* The leader's own login, spelled out: an officer who wants to watch
              this mission from the phone side needs the exact account to sign in
              with, and it should never be a guess. */}
          {roll.leaderEmail && (
            <LeaderLoginLine email={roll.leaderEmail} />
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            className="kdx-chip"
            style={{
              background: `${stage.color}1A`,
              borderColor: stage.color,
              color: stage.color,
            }}
          >
            <Icon size={12} />
            {stage.label}
          </span>

          {showIncident && onOpenIncident && (
            <button
              type="button"
              className="kdx-btn kdx-btn-sm"
              onClick={() => onOpenIncident(roll.reportPublicId)}
            >
              Incident
              <ChevronRight size={13} />
            </button>
          )}

          {isLiveStage(roll.status) && onStandDown && (
            <button
              type="button"
              className="kdx-btn kdx-btn-danger kdx-btn-sm"
              disabled={busy}
              onClick={() => setConfirming((open) => !open)}
            >
              <Ban size={13} />
              Stand down
            </button>
          )}
        </div>
      </div>

      <div className="kdx-mission-body">
        {closed ? (
          <div className="kdx-warn">
            <Ban size={15} />
            <span>
              This mission ended at <strong>{stage.label.toLowerCase()}</strong>
              {roll.declineReason || roll.cancelReason ? ` — ${roll.declineReason || roll.cancelReason}` : ""}.
            </span>
          </div>
        ) : (
          <div className="kdx-stage-strip kdx-scroll-x">
            {STAGE_ORDER.map((status, index) => {
              const StepIcon = STAGE_ICONS[status] ?? ClipboardList;
              const done = index < reachedIndex;
              const now = index === reachedIndex;

              return (
                <span
                  key={status}
                  className={`kdx-step ${done ? "kdx-step-done" : ""} ${now ? "kdx-step-now" : ""}`}
                >
                  <StepIcon size={12} />
                  {stageMeta(status).label}
                </span>
              );
            })}
          </div>
        )}

        {roll.missionNotes && (
          <div className="kdx-note-box">
            <strong>Mission brief:</strong> {roll.missionNotes}
          </div>
        )}

        {showIncident && (
          <div className="kdx-chip-row">
            <span className="kdx-chip kdx-chip-info">
              <TriangleAlert size={11} />
              {humanizeHazard(roll.hazardType)} · {roll.severityLevel}
            </span>
            <span className="kdx-chip">
              <MapPin size={11} />
              {roll.landmark || roll.reportPublicId}
            </span>
            {typeof roll.affectedPopulation === "number" && (
              <span className="kdx-chip">
                <Users size={11} />
                {roll.affectedPopulation} affected
              </span>
            )}
            {typeof roll.recommendationScore === "number" && (
              <span className="kdx-chip kdx-chip-good">
                <Timer size={11} />
                fit {Math.round(roll.recommendationScore)}
              </span>
            )}
            {roll.baseLocationLabel && (
              <span className="kdx-chip">
                <Navigation size={11} />
                from {roll.baseLocationLabel}
              </span>
            )}
          </div>
        )}

        {(roll.peopleRescued !== null || roll.peopleEvacuated !== null) &&
          (roll.status === "COMPLETED" || roll.status === "RETURNING") && (
            <div className="kdx-outcome">
              <div className="kdx-stat">
                <div className="kdx-stat-num">{roll.peopleRescued ?? 0}</div>
                <div className="kdx-stat-cap">People rescued</div>
              </div>
              <div className="kdx-stat">
                <div className="kdx-stat-num">{roll.peopleEvacuated ?? 0}</div>
                <div className="kdx-stat-cap">People evacuated</div>
              </div>
              {roll.status === "COMPLETED" ? (
                <div className="kdx-stat">
                  <div className="kdx-stat-num">
                    {clockTime(roll.events[roll.events.length - 1]?.createdAt ?? roll.updatedAt)}
                  </div>
                  <div className="kdx-stat-cap">Closed at</div>
                </div>
              ) : (
                <div className="kdx-stat">
                  <div className="kdx-stat-num">
                    {Math.max(roll.peopleRescued ?? 0, roll.peopleEvacuated ?? 0)}
                  </div>
                  <div className="kdx-stat-cap">Needing shelter now</div>
                </div>
              )}
            </div>
          )}

        {canShelter && (
          <div style={{ display: "grid", gap: 12 }}>
            {handoff ? <ShelterHandoffView group={handoff} /> : null}

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShelterOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: shelterButtonColor(handoff),
                  color: "#FFFFFF",
                  fontSize: 14.5,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  boxShadow: `0 10px 24px ${shelterButtonColor(handoff)}59`,
                }}
              >
                <Warehouse size={17} />
                {shelterButtonLabel(handoff)}
              </button>
              <span className="kdx-muted-line">
                {shelterButtonHint(handoff, roll.district)}
              </span>
              {handoff && (
                <button
                  type="button"
                  className="kdx-btn kdx-btn-sm"
                  onClick={() => void refreshHandoff()}
                  title="Re-read the shelter handoff now"
                >
                  <RefreshCw size={13} />
                  Refresh
                </button>
              )}
            </div>
          </div>
        )}

        {roll.events.length > 0 && (
          <div>
            <div className="kdx-fact-label" style={{ marginBottom: 4 }}>
              <Timer size={12} />
              Stage trail
            </div>

            <div className="kdx-trail">
              {[...roll.events].reverse().map((event, index) => {
                const meta = stageMeta(event.toStatus);

                return (
                  <div
                    key={event.id}
                    className={`kdx-trail-item ${index === 0 ? "kdx-trail-lead" : ""}`}
                  >
                    <div className="kdx-trail-text">
                      <span className="kdx-trail-title">
                        {meta.label}
                        <span className="kdx-muted-line"> · {clockTime(event.createdAt)}</span>
                      </span>
                      <span className="kdx-trail-meta">
                        {event.actorName || "Unknown"}
                        {event.actorRole ? ` (${event.actorRole.replace(/_/g, " ").toLowerCase()})` : ""}
                        {event.note ? ` — ${event.note}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="kdx-chip-row">
          <a
            className="kdx-chip kdx-chip-info"
            href={`tel:${roll.leaderPhone}`}
            style={{ textDecoration: "none" }}
          >
            <Phone size={11} />
            {roll.leaderPhone}
          </a>
          <span className="kdx-chip">
            <Users size={11} />
            {roll.leaderFullName}
          </span>
          {roll.dispatchedByName && (
            <span className="kdx-chip">
              <ShieldAlert size={11} />
              tasked by {roll.dispatchedByName}
            </span>
          )}
          <span className="kdx-chip">
            <Timer size={11} />
            updated {formatDateTime(roll.updatedAt)}
          </span>
        </div>

        {confirming && onStandDown && (
          <div className="kdx-form" style={{ paddingTop: 4 }}>
            <label className="kdx-label" htmlFor={`standdown-${roll.dispatchCode}`}>
              Why is this mission being stood down?
            </label>
            <textarea
              id={`standdown-${roll.dispatchCode}`}
              className="kdx-area"
              value={reason}
              placeholder="e.g. Road to the site is cut; the task was handed to the Divisional Secretariat."
              onChange={(event) => setReason(event.target.value)}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="kdx-btn" onClick={() => setConfirming(false)}>
                Keep the mission running
              </button>
              <button
                type="button"
                className="kdx-btn kdx-btn-danger"
                disabled={busy || reason.trim().length < 5}
                onClick={() => {
                  onStandDown(roll, reason.trim());
                  setConfirming(false);
                  setReason("");
                }}
              >
                <ArrowDownToLine size={13} />
                Stand {roll.teamName} down
              </button>
            </div>
          </div>
        )}
      </div>
    </article>

      {shelterOpen && token && (
        <ShelterAllocateModal
          token={token}
          roll={roll}
          district={district}
          onClose={() => {
            setShelterOpen(false);
            void refreshHandoff();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Shelter allocation, opened straight from a mission.
 *
 * The officer clicks "Allocate shelter" on a live or completed rescue and this
 * box opens on real data only: it raises (or reuses) the mission's awaiting-
 * shelter group from the rescued headcount and incident point, then hands the
 * desk to the same AllocationEditor the shelter register uses, which recommends
 * the nearest usable shelters in that district automatically. Nothing is faked —
 * if the mission has not reported a headcount yet, the officer enters the real
 * number they are hearing from the field before the desk opens.
 * ------------------------------------------------------------------ */

function ShelterAllocateModal({
  token,
  roll,
  district,
  onClose,
}: {
  token: string;
  roll: DispatchRoll;
  district?: string;
  onClose: () => void;
}) {
  const reported = Math.max(roll.peopleRescued ?? 0, roll.peopleEvacuated ?? 0);

  const [shelters, setShelters] = useState<ShelterRoll[]>([]);
  const [group, setGroup] = useState<EvacueeGroup | null>(null);
  const [peopleInput, setPeopleInput] = useState(reported > 0 ? String(reported) : "");
  const [loading, setLoading] = useState(true);
  const [raising, setRaising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // After an allocation lands (or on reopening a mission that already has one),
  // the desk shows the live handoff rather than the editor; the officer drops back
  // into the editor only to change the plan.
  const [replan, setReplan] = useState(false);

  // The district's real, open shelters — the same register the desk reads. When
  // the mission already reported its headcount, the shelter need is raised in the
  // same breath so the desk opens in one click; the setState calls live inside the
  // promise callbacks (an async answer), never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    fetchShelters(token, { activeOnly: true })
      .then((rows) => {
        if (cancelled) return;
        // Only shelters that still have space — a full one is not a choice.
        setShelters(rows.filter((s) => s.remainingAllocatable > 0));

        if (reported <= 0) return undefined;

        setRaising(true);
        return requestShelterForDispatch(token, roll.id, reported)
          .then((raised) => {
            if (!cancelled) setGroup(raised);
          })
          .catch((cause: Error) => {
            if (!cancelled) {
              setError(cause.message || "The shelter request could not be raised.");
            }
          })
          .finally(() => {
            if (!cancelled) setRaising(false);
          });
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message || "The shelter register could not load.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, roll.id, reported]);

  const raise = async (count: number) => {
    setRaising(true);
    setError(null);
    setReplan(false);

    try {
      const raised = await requestShelterForDispatch(token, roll.id, count);
      setGroup(raised);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The shelter request could not be raised.");
    } finally {
      setRaising(false);
    }
  };

  // A committed allocation is re-read from the server (so the desk shows the real
  // reserved beds and status) instead of leaving the officer on a spent editor.
  const handleAllocated = (message: string) => {
    setNotice(message);
    setReplan(false);

    requestShelterForDispatch(token, roll.id)
      .then((fresh) => setGroup(fresh))
      .catch(() => undefined);
  };

  const parsed = Math.trunc(Number(peopleInput));
  const canRaise = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="kdx-modal-back" onClick={onClose}>
      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
      <div className="kdx-modal kdx-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="kdx-modal-head">
          <div>
            <div className="kdx-modal-title">Allocate shelter · {roll.dispatchCode}</div>
            <div className="kdx-modal-sub">
              {roll.teamName} · {roll.district} District. These are the real open beds
              registered for the district; the nearest ones that can take the group are
              recommended automatically from the incident location.
            </div>
          </div>
          <button type="button" className="kdx-x" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="kdx-modal-body">
          {loading ? (
            <div className="kdx-loading">
              <Loader2 className="kdx-spin" size={16} /> Loading {roll.district} shelters…
            </div>
          ) : group ? (
            group.status === "AWAITING_SHELTER" || group.status === "DECLINED" || replan ? (
              <AllocationEditor
                key={`${group.id}-${replan ? "replan" : "edit"}`}
                token={token}
                group={group}
                shelters={shelters}
                district={roll.district || district || ""}
                onDone={handleAllocated}
                onBack={onClose}
              />
            ) : (
              <>
                <ShelterHandoffView group={group} />
                <div className="kdx-modal-foot">
                  {group.status === "ALLOCATED" && (
                    <button
                      type="button"
                      className="kdx-btn"
                      onClick={() => {
                        setNotice(null);
                        setReplan(true);
                      }}
                    >
                      <RefreshCw size={14} />
                      Re-plan allocation
                    </button>
                  )}
                  <button type="button" className="kdx-btn kdx-btn-primary" onClick={onClose}>
                    <Check size={14} />
                    Done
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              {error && (
                <div className="kdx-error">
                  <TriangleAlert size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="kdx-form">
                <label className="kdx-label" htmlFor={`shelter-people-${roll.dispatchCode}`}>
                  How many people from {roll.dispatchCode} need shelter?
                </label>
                <input
                  id={`shelter-people-${roll.dispatchCode}`}
                  className="kdx-input"
                  value={peopleInput}
                  inputMode="numeric"
                  placeholder="e.g. 18"
                  onChange={(event) => setPeopleInput(event.target.value)}
                />
                <span className="kdx-hint" style={{ marginTop: 6 }}>
                  Prefilled from the team's reported headcount when there is one ·{" "}
                  {shelters.length} open shelter{shelters.length === 1 ? "" : "s"} in{" "}
                  {roll.district}.
                </span>
              </div>

              <div className="kdx-modal-foot">
                <button type="button" className="kdx-btn" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="kdx-btn kdx-btn-primary"
                  disabled={!canRaise || raising}
                  onClick={() => void raise(parsed)}
                >
                  {raising ? (
                    <Loader2 className="kdx-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Recommend shelters
                </button>
              </div>
            </>
          )}

          {notice && (
            <div
              className="kdx-hint"
              style={{ color: Colors.success, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}
            >
              {notice}
              <button type="button" className="kdx-btn kdx-btn-sm" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The team leader's login, shown where an officer can act on it.
 *
 * Seeded leaders sign in with their email, so putting the address on the
 * mission card (with a copy button) lets an officer open the same task on a
 * phone without hunting through the database.
 * ------------------------------------------------------------------ */

function LeaderLoginLine({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* A denied clipboard (insecure context) is not worth bothering the officer about. */
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 2,
        padding: "3px 8px 3px 6px",
        borderRadius: 8,
        background: Colors.blueLight,
        border: `1px solid ${Colors.border}`,
        alignSelf: "flex-start",
        maxWidth: "100%",
      }}
    >
      <Mail size={12} color={Colors.blue} style={{ flexShrink: 0 } as React.CSSProperties} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: Colors.blue,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={`${email} — the team leader's login for the mobile app`}
      >
        {email}
      </span>
      <button
        type="button"
        onClick={copy}
        title="Copy the leader login"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          border: "none",
          background: "transparent",
          color: copied ? Colors.success : Colors.blue,
          fontWeight: 800,
          fontSize: 11,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
