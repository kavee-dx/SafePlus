import { useState } from "react";
import {
  ArrowDownToLine,
  Ban,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flag,
  MapPin,
  Navigation,
  Phone,
  Route,
  ShieldAlert,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type DispatchRoll,
  type DispatchStatus,
} from "../services/kaveesha-dispatchApi";
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

export function MissionCard({
  roll,
  showIncident = true,
  busy = false,
  onStandDown,
  onOpenIncident,
}: {
  roll: DispatchRoll;
  showIncident?: boolean;
  busy?: boolean;
  onStandDown?: (roll: DispatchRoll, reason: string) => void;
  onOpenIncident?: (reportPublicId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const stage = stageMeta(roll.status);
  const Icon = STAGE_ICONS[roll.status] ?? ClipboardList;
  const reachedIndex = STAGE_ORDER.indexOf(roll.status);
  const closed = reachedIndex === -1;

  return (
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
          roll.status === "COMPLETED" && (
            <div className="kdx-outcome">
              <div className="kdx-stat">
                <div className="kdx-stat-num">{roll.peopleRescued ?? 0}</div>
                <div className="kdx-stat-cap">People rescued</div>
              </div>
              <div className="kdx-stat">
                <div className="kdx-stat-num">{roll.peopleEvacuated ?? 0}</div>
                <div className="kdx-stat-cap">People evacuated</div>
              </div>
              <div className="kdx-stat">
                <div className="kdx-stat-num">
                  {clockTime(roll.events[roll.events.length - 1]?.createdAt ?? roll.updatedAt)}
                </div>
                <div className="kdx-stat-cap">Closed at</div>
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
  );
}
