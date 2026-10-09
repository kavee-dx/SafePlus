import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Flag,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Timer,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type DispatchRoll,
  type DispatchStatus,
  type LeaderWorkspace,
  fetchMyMission,
  updateMissionStage,
} from "../services/kaveesha-dispatchApi";
import { DISPATCH_CSS } from "../styles/kaveesha-dispatchStyles";
import {
  formatDateTime,
  humanizeHazard,
  relativeTime,
  stageMeta,
} from "../utils/kaveesha-dispatchFormat";
import KaveeshaResponseMap, { type ResponseMapMarker } from "./kaveesha-ResponseMap";
import { teamTypeIcon } from "../constants/kaveesha-rescueTeamOptions";

/* ------------------------------------------------------------------ *
 * The team leader's assignment board (UC-03, team side).
 *
 * One live mission at a time. The officer's brief is read here, and the
 * stages the leader reports are what the district control room sees.
 * ------------------------------------------------------------------ */

const STAGE_BUTTONS: Record<DispatchStatus, { label: string; hint: string; icon: LucideIcon }> = {
  ACCEPTED: {
    label: "Accept the task",
    hint: "Roll out. The district sees you have taken it.",
    icon: CheckCircle2,
  },
  EN_ROUTE: {
    label: "Start the journey",
    hint: "Your team is moving towards the incident.",
    icon: Navigation,
  },
  ARRIVED: {
    label: "Arrived on scene",
    hint: "The team is at the location in the brief.",
    icon: MapPin,
  },
  RESCUE_IN_PROGRESS: {
    label: "Rescue under way",
    hint: "Work has started at the scene.",
    icon: ShieldAlert,
  },
  RETURNING: {
    label: "Returning to base",
    hint: "The job is done and the team is heading back.",
    icon: Route,
  },
  COMPLETED: {
    label: "Complete and hand the team back",
    hint: "Tell the district how many people you brought out.",
    icon: Flag,
  },
  DECLINED: {
    label: "Decline this tasking",
    hint: "Only if your team genuinely cannot take it. Say why.",
    icon: ShieldOff,
  },
  DISPATCHED: { label: "Dispatched", hint: "", icon: ClipboardList },
  CANCELLED: { label: "Stood down", hint: "", icon: ClipboardList },
};

/** Stages that end the mission, so the team is free again. */
const CLOSING: DispatchStatus[] = ["COMPLETED", "DECLINED"];

function factorOf(roll: DispatchRoll | null, key: string): number | null {
  const value = roll?.recommendationFactors?.[key];

  return typeof value === "number" ? value : null;
}

function iconForType(type: string | null | undefined): LucideIcon {
  return type ? teamTypeIcon(type) : ShieldCheck;
}

/** The current stage read as a verb phrase, so it can sit in a sentence. */
function stageLabel(status: DispatchStatus): string {
  return stageMeta(status).label.toLowerCase();
}

export default function KaveeshaAssignmentPanel({
  token,
  onLoaded,
}: {
  token: string;
  onLoaded?: (workspace: LeaderWorkspace) => void;
}) {
  const [workspace, setWorkspace] = useState<LeaderWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<DispatchStatus | null>(null);
  const [note, setNote] = useState("");
  const [rescued, setRescued] = useState("");
  const [evacuated, setEvacuated] = useState("");
  const [opening, setOpening] = useState<DispatchStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  /** Pull the workspace again. Busy flags are raised here, never inside the effect. */
  const load = () => {
    if (!token) return;

    setLoading(true);
    setError(null);
    setTick((value) => value + 1);
  };

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchMyMission(token)
      .then((result) => {
        if (cancelled) return;
        setWorkspace(result);
        onLoaded?.(result);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, tick, onLoaded]);

  const active = workspace?.active ?? null;
  const nextStatuses = workspace?.nextStatuses ?? [];
  const eta = factorOf(active, "etaMinutes");
  const distance = factorOf(active, "distanceKm");
  const stage = stageMeta(active?.status ?? "DISPATCHED");

  const markers = useMemo<ResponseMapMarker[]>(() => {
    if (!active) return [];

    const list: ResponseMapMarker[] = [];

    if (active.incidentLat && active.incidentLng) {
      list.push({
        id: "incident",
        lat: active.incidentLat,
        lng: active.incidentLng,
        tone: "incident",
        title: `${humanizeHazard(active.hazardType)} — ${active.reportPublicId}`,
        lines: [
          active.landmark || "No landmark recorded",
          `${active.severityLevel}${
            typeof active.affectedPopulation === "number"
              ? ` · ${active.affectedPopulation} people affected`
              : ""
          }`,
        ],
      });
    }

    if (active.baseLatitude && active.baseLongitude) {
      list.push({
        id: active.teamId,
        lat: active.baseLatitude,
        lng: active.baseLongitude,
        tone: "team",
        badge: "1",
        title: `${active.teamName} (your base)`,
        lines: [
          active.baseLocationLabel || "No staging label saved",
          distance !== null ? `about ${distance} km from the incident` : "Distance not recorded",
        ],
      });
    }

    return list;
  }, [active, distance]);

  const send = async (status: DispatchStatus) => {
    if (!token || !active) return;

    setBusy(status);
    setError(null);
    setNotice(null);

    try {
      const roll = await updateMissionStage(token, active.id, {
        status,
        note: note.trim() || undefined,
        peopleRescued: status === "COMPLETED" && rescued.trim() !== "" ? Number(rescued) : undefined,
        peopleEvacuated:
          status === "COMPLETED" && evacuated.trim() !== "" ? Number(evacuated) : undefined,
      });

      setNote("");
      setRescued("");
      setEvacuated("");
      setOpening(null);
      setNotice(
        status === "COMPLETED"
          ? `${roll.dispatchCode} is closed. Your team is available for tasking again.`
          : `${roll.dispatchCode} is now marked ${stageMeta(roll.status).label.toLowerCase()}.`
      );

      const fresh = await fetchMyMission(token);

      setWorkspace(fresh);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The stage could not be sent.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !workspace) {
    return (
      <div className="kdx-loading">
        <Loader2 size={16} className="kdx-spin" />
        Checking whether the district has tasked your team…
      </div>
    );
  }

  return (
    <div className="kdx-stack">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="kdx-panel-sub">
          {workspace?.team.name ?? "Your team"} is{" "}
          <strong style={{ color: Colors.navy }}>
            {workspace?.team.availability.replace(/_/g, " ").toLowerCase() ?? "…"}
          </strong>
        </span>

        <button type="button" className="kdx-btn" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={13} className="kdx-spin" /> : <RefreshCw size={13} />}
          Check for new taskings
        </button>
      </div>

      {notice && (
        <div className="kdx-success">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      {error && (
        <div className="kdx-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {!active ? (
        <div className="kdx-panel">
          <div className="kdx-empty">
            <Home size={26} />
            <span>
              No mission is on your team right now. When a district officer
              dispatches you, the brief and the map point appear here.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="kdx-hero">
            <div className="kdx-hero-body">
              <div className="kdx-hero-code">
                {active.dispatchCode} · tasked {relativeTime(active.createdAt)} by{" "}
                {active.dispatchedByName || "the district control room"}
              </div>
              <div className="kdx-hero-title">
                {humanizeHazard(active.hazardType)} · {active.severityLevel}
              </div>
              <div className="kdx-hero-sub">
                {active.landmark || active.reportPublicId} — {active.district} District
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <span className="kdx-hero-chip">
                  <Timer size={12} />
                  {stageMeta(active.status).label}
                </span>
                {distance !== null && (
                  <span className="kdx-hero-chip">
                    <MapPin size={12} />
                    {distance} km away
                  </span>
                )}
                {eta !== null && (
                  <span className="kdx-hero-chip">
                    <Navigation size={12} />
                    about {eta} min travel
                  </span>
                )}
                {typeof active.affectedPopulation === "number" && (
                  <span className="kdx-hero-chip">
                    <Users size={12} />
                    {active.affectedPopulation} affected
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {active.controlPhone ? (
                <a
                  className="kdx-hero-chip"
                  href={`tel:${active.controlPhone}`}
                  style={{ textDecoration: "none" }}
                >
                  <Phone size={12} />
                  Control room: {active.controlPhone}
                </a>
              ) : (
                <span className="kdx-hero-chip">
                  <Phone size={12} />
                  Tasked by {active.dispatchedByName || "the district control room"}
                </span>
              )}

              <span className="kdx-hero-chip">
                <ClipboardList size={12} />
                {active.reportPublicId}
              </span>
            </div>
          </div>

          <div className="kdx-facts">
            <div className="kdx-fact">
              <div className="kdx-fact-label">
                <ShieldCheck size={12} />
                Team tasked
              </div>
              <div className="kdx-fact-text">
                {(() => {
                  const Icon = iconForType(active.teamType);

                  return (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 800,
                      }}
                    >
                      <Icon size={15} style={{ color: Colors.blue }} />
                      {active.teamName}
                    </span>
                  );
                })()}
                {active.teamType && (
                  <span className="kdx-chip" style={{ marginLeft: 6 }}>
                    {active.teamType}
                  </span>
                )}
                {active.organizationName && (
                  <div className="kdx-muted-line" style={{ marginTop: 3 }}>
                    {active.organizationName}
                  </div>
                )}
              </div>
            </div>

            <div className="kdx-fact">
              <div className="kdx-fact-label">
                <Users size={12} />
                Your leader
              </div>
              <div className="kdx-fact-text">
                {active.leaderFullName}
                <a
                  className="kdx-chip kdx-chip-info"
                  href={`tel:${active.leaderPhone}`}
                  style={{ textDecoration: "none", marginLeft: 6 }}
                >
                  <Phone size={10} />
                  {active.leaderPhone}
                </a>
                <div className="kdx-muted-line" style={{ marginTop: 3 }}>
                  {active.memberCount} members on the roll
                </div>
              </div>
            </div>

            <div className="kdx-fact">
              <div className="kdx-fact-label">
                <MapPin size={12} />
                Staging point
              </div>
              <div className="kdx-fact-text">
                {active.baseLocationLabel || "No label saved on your base"}
              </div>
            </div>

            <div className="kdx-fact">
              <div className="kdx-fact-label">
                <Timer size={12} />
                Tasked
              </div>
              <div className="kdx-fact-text">
                {formatDateTime(active.createdAt)}
                <div className="kdx-muted-line" style={{ marginTop: 3 }}>
                  {relativeTime(active.createdAt)} · {stageMeta(active.status).label}
                </div>
              </div>
            </div>
          </div>

          {active.missionNotes ? (
            <div className="kdx-note-box">
              <strong>The officer's brief:</strong> {active.missionNotes}
            </div>
          ) : (
            <div className="kdx-warn">
              <TriangleAlert size={15} />
              <span>
                No written brief came with this tasking. Call the district control
                room before you roll out and get the details.
              </span>
            </div>
          )}

          {markers.length > 0 && (
            <KaveeshaResponseMap
              markers={markers}
              lines={
                active.incidentLat && active.incidentLng && active.baseLatitude && active.baseLongitude
                  ? [
                      {
                        from: [active.baseLatitude, active.baseLongitude],
                        to: [active.incidentLat, active.incidentLng],
                        primary: true,
                        label: distance !== null ? `${distance} km` : undefined,
                      },
                    ]
                  : []
              }
              boundaryDistrict={active.district}
              height={320}
              caption="Your route to the incident"
            />
          )}

          {!active.incidentLat && (
            <div className="kdx-danger">
              <MapPin size={15} />
              <span>
                This incident was dispatched without a map point. Call the control
                room for directions before you move.
              </span>
            </div>
          )}

          <section className="kdx-panel">
            <div className="kdx-panel-head">
              <span className="kdx-panel-title">
                <Send size={15} />
                Report your stage
              </span>
              <span className="kdx-panel-sub">
                now:{" "}
                <span style={{ color: stage.color }}>
                  {stageLabel(active.status)}
                </span>
                {active.events.length > 0
                  ? ` · reported ${relativeTime(active.events[active.events.length - 1].createdAt)}`
                  : ""}
              </span>
            </div>

            <div className="kdx-panel-body">
              {nextStatuses.length === 0 ? (
                <div className="kdx-muted-line">
                  This mission is closed. Nothing more to report on it.
                </div>
              ) : (
                <div className="kdx-stack" style={{ gap: 14 }}>
                  <div className="kdx-stage-grid">
                    {nextStatuses.map((status, index) => {
                      const meta = STAGE_BUTTONS[status];
                      const Icon = meta.icon;

                      return (
                        <button
                          key={status}
                          type="button"
                          className={`kdx-stage-btn ${
                            index === 0 && !CLOSING.includes(status) ? "kdx-stage-btn-next" : ""
                          } ${CLOSING.includes(status) ? "kdx-stage-btn-stop" : ""}`}
                          disabled={busy !== null}
                          onClick={() => {
                            if (CLOSING.includes(status)) {
                              setOpening(status);

                              return;
                            }

                            send(status);
                          }}
                        >
                          <span className="kdx-stage-icon">
                            {busy === status ? <Loader2 size={15} className="kdx-spin" /> : <Icon size={15} />}
                          </span>
                          <span>
                            {meta.label}
                            <span
                              style={{
                                display: "block",
                                marginTop: 2,
                                fontSize: 11,
                                fontWeight: 600,
                                opacity: 0.85,
                              }}
                            >
                              {meta.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="kdx-hint">
                    Only the next honest stages are offered. A team cannot report
                    it has arrived before it started the journey, and the district
                    board updates the moment you press one.
                  </p>
                </div>
              )}
            </div>
          </section>

          {opening && (
            <div className="kdx-modal-back" role="dialog" aria-modal="true">
              <div className="kdx-modal">
                <div className="kdx-modal-head">
                  <div>
                    <div className="kdx-modal-title">
                      {STAGE_BUTTONS[opening].label}
                    </div>
                    <div className="kdx-modal-sub">
                      {opening === "COMPLETED"
                        ? `Closing ${active.dispatchCode} hands your team back to the district as available.`
                        : `Declining ${active.dispatchCode} tells the district you cannot take this tasking, and frees you for another team.`}
                    </div>
                  </div>
                  <button type="button" className="kdx-x" onClick={() => setOpening(null)}>
                    <X size={15} />
                  </button>
                </div>

                <div className="kdx-modal-body">
                  {opening === "COMPLETED" && (
                    <div className="kdx-outcome">
                      <div className="kdx-form">
                        <label className="kdx-label" htmlFor="people-rescued">
                          People rescued
                        </label>
                        <input
                          id="people-rescued"
                          className="kdx-input"
                          type="number"
                          min={0}
                          value={rescued}
                          placeholder="0"
                          onChange={(event) => setRescued(event.target.value)}
                        />
                      </div>
                      <div className="kdx-form">
                        <label className="kdx-label" htmlFor="people-evacuated">
                          People evacuated to safety
                        </label>
                        <input
                          id="people-evacuated"
                          className="kdx-input"
                          type="number"
                          min={0}
                          value={evacuated}
                          placeholder="0"
                          onChange={(event) => setEvacuated(event.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="kdx-form">
                    <label className="kdx-label" htmlFor="stage-note">
                      {opening === "DECLINED"
                        ? "Why is your team declining? (required)"
                        : "Note for the district (optional)"}
                    </label>
                    <textarea
                      id="stage-note"
                      className="kdx-area"
                      value={note}
                      maxLength={300}
                      placeholder={
                        opening === "DECLINED"
                          ? "e.g. Two members are sick and the boat is in for repairs."
                          : "e.g. Everyone is out of the house; the old folk are at the centre."
                      }
                      onChange={(event) => setNote(event.target.value)}
                    />
                    <span className="kdx-hint">
                      {note.length}/300 · this goes on the mission trail the officer
                      reads.
                    </span>
                  </div>

                  {opening === "COMPLETED" && (
                    <p className="kdx-hint">
                      The numbers you give here are what the district uses to work
                      out shelter demand for the people you brought out.
                    </p>
                  )}
                </div>

                <div className="kdx-modal-foot">
                  <button type="button" className="kdx-btn" onClick={() => setOpening(null)}>
                    <ArrowLeft size={13} />
                    Back
                  </button>
                  <button
                    type="button"
                    className={`kdx-btn ${
                      opening === "DECLINED" ? "kdx-btn-danger" : "kdx-btn-task"
                    }`}
                    disabled={
                      busy !== null || (opening === "DECLINED" && note.trim().length < 5)
                    }
                    onClick={() => send(opening)}
                  >
                    {busy === opening ? (
                      <Loader2 size={14} className="kdx-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          <section className="kdx-panel">
            <div className="kdx-panel-head">
              <span className="kdx-panel-title">
                <Timer size={15} />
                What the district has seen so far
              </span>
              <span className="kdx-panel-sub">
                current stage:{" "}
                <span style={{ color: stage.color }}>{stage.label.toLowerCase()}</span>
              </span>
            </div>

            <div className="kdx-panel-body">
              <div className="kdx-trail">
                {[...active.events].reverse().map((event, index) => (
                  <div
                    key={event.id}
                    className={`kdx-trail-item ${index === 0 ? "kdx-trail-lead" : ""}`}
                  >
                    <div className="kdx-trail-text">
                      <span className="kdx-trail-title">
                        {stageMeta(event.toStatus).label}
                        <span className="kdx-muted-line">
                          {" "}
                          · {formatDateTime(event.createdAt)}
                        </span>
                      </span>
                      <span className="kdx-trail-meta">
                        {event.actorName || "Unknown"}
                        {event.note ? ` — ${event.note}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {(workspace?.history.length ?? 0) > 0 && (
        <details className="kdx-panel" style={{ padding: "14px 16px" }}>
          <summary
            className="kdx-panel-title"
            style={{ cursor: "pointer", listStyle: "none", display: "flex", gap: 8 }}
          >
            <ClipboardList size={15} />
            Your last {workspace?.history.length} closed mission
            {workspace?.history.length === 1 ? "" : "s"}
            <ChevronDown size={14} />
          </summary>

          <div className="kdx-stack" style={{ marginTop: 12 }}>
            {workspace?.history.map((roll) => (
              <div key={roll.id} className="kdx-note-box">
                <strong>{roll.dispatchCode}</strong> — {humanizeHazard(roll.hazardType)} ·{" "}
                {stageMeta(roll.status).label.toLowerCase()} ·{" "}
                {formatDateTime(roll.updatedAt)}
                {typeof roll.peopleRescued === "number"
                  ? ` · ${roll.peopleRescued} rescued`
                  : ""}
                {typeof roll.peopleEvacuated === "number"
                  ? ` · ${roll.peopleEvacuated} evacuated`
                  : ""}
              </div>
            ))}
          </div>
        </details>
      )}

      <style>{DISPATCH_CSS}</style>
    </div>
  );
}
