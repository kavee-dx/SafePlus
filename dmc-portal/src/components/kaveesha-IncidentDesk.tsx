import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type IncidentSummary,
  DispatchApiError,
  acceptIncident,
  fetchIncidents,
  openDispatchStream,
} from "../services/kaveesha-dispatchApi";
import { DESK_CSS, DISPATCH_CSS } from "../styles/kaveesha-dispatchStyles";
import {
  humanizeHazard,
  relativeTime,
  severityColor,
} from "../utils/kaveesha-dispatchFormat";

/* ------------------------------------------------------------------ *
 * The district incident desk (UC-03).
 *
 * Verification is somebody else's job. A DMC officer has already decided that a
 * citizen's report is true, and only then does it become an incident — so this
 * screen holds no verify button at all. It is a queue of verified incidents in
 * the officer's own district, and it does two things:
 *
 *   1. let the district take an incident on (its own record, not a verification)
 *   2. open the incident on its response page, where the teams are ranked and
 *      tasked against the map point
 *
 * Reading an incident, its pictures, its missions and the teams around it all
 * happens on that page, so nothing is shown twice.
 * ------------------------------------------------------------------ */

/**
 * The five things a verified incident can be on this desk. The last two are
 * different: every team coming back is not the same as the district finishing
 * with the incident, and conflating them is how a control room loses track of
 * who still owns the job.
 */
type DeskStage =
  | "needs_acceptance"
  | "awaiting_team"
  | "working"
  | "wrapped"
  | "closed";
type Filter = "all" | DeskStage;

const STAGE_META: Record<DeskStage, { label: string; color: string }> = {
  needs_acceptance: { label: "Needs your yes", color: Colors.amber },
  awaiting_team: { label: "Taken on, no team", color: Colors.blue },
  working: { label: "Team in the field", color: Colors.red },
  wrapped: { label: "Teams back · not closed", color: Colors.blueDark },
  closed: { label: "Closed", color: Colors.success },
};

const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: "all", label: "Everything", hint: "Every verified incident in your district." },
  { key: "needs_acceptance", label: "Needs your yes", hint: "Verified, and nobody has taken them on." },
  { key: "awaiting_team", label: "No team yet", hint: "Taken on and still waiting for a tasking." },
  { key: "working", label: "On mission", hint: "Teams out there for you right now." },
  { key: "wrapped", label: "Teams back", hint: "Every mission ended, and the incident is still open." },
  { key: "closed", label: "Closed", hint: "The district has finished with them." },
];

const FILTER_ICONS: Record<Filter, typeof Inbox> = {
  all: Inbox,
  needs_acceptance: ShieldCheck,
  awaiting_team: Users,
  working: Navigation,
  wrapped: Clock,
  closed: CheckCircle2,
};

function stageOf(incident: IncidentSummary): DeskStage {
  if (incident.resolvedAt) return "closed";
  if (!incident.acceptedAt) return "needs_acceptance";
  if (incident.liveDispatchCount > 0) return "working";
  if (incident.dispatchCount > 0) return "wrapped";

  return "awaiting_team";
}

const STAGE_RANK: Record<DeskStage, number> = {
  needs_acceptance: 0,
  working: 1,
  awaiting_team: 2,
  wrapped: 3,
  closed: 4,
};

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
  LOW: 3,
};

/** What is unstitched first, then danger to life, then severity, then age. */
function deskOrder(a: IncidentSummary, b: IncidentSummary): number {
  const byStage = STAGE_RANK[stageOf(a)] - STAGE_RANK[stageOf(b)];

  if (byStage !== 0) return byStage;

  const byDanger = Number(b.immediateDanger) - Number(a.immediateDanger);

  if (byDanger !== 0) return byDanger;

  const bySeverity =
    (SEVERITY_RANK[a.severityLevel.toUpperCase()] ?? 4) -
    (SEVERITY_RANK[b.severityLevel.toUpperCase()] ?? 4);

  if (bySeverity !== 0) return bySeverity;

  return new Date(a.verifiedAt ?? 0).getTime() - new Date(b.verifiedAt ?? 0).getTime();
}

/**
 * How long an incident has been waiting, said the way a control room says it.
 * Measured from the district's own acceptance once there is one.
 */
function waitingSince(incident: IncidentSummary, now: number): string {
  const from = incident.acceptedAt ?? incident.verifiedAt;

  if (!from) return "—";

  const minutes = Math.max(0, Math.round((now - new Date(from).getTime()) / 60000));

  if (minutes < 45) return "just now";
  if (minutes < 90) return "1 h";
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`;

  return `${Math.round(minutes / (60 * 24))} d`;
}

/** A day without an answer on a verified incident is too long. */
const STALE_HOURS = 24;

function isStale(incident: IncidentSummary, now: number): boolean {
  const from = incident.acceptedAt ?? incident.verifiedAt;

  if (!from) return false;

  return now - new Date(from).getTime() > STALE_HOURS * 60 * 60 * 1000;
}

export default function KaveeshaIncidentDesk({
  token,
  district,
  onOpenIncident,
}: {
  token: string;
  /** Empty until the officer's assignment has been read. */
  district: string;
  /** Open one incident on its response page. */
  onOpenIncident: (reportId: string) => void;
}) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /* The live feed's last line, and whether it is currently held open. The board
     shows both so an officer never has to wonder whether what they are reading
     is current or twenty seconds old. */
  const [liveFeed, setLiveFeed] = useState<string | null>(null);
  const [streamUp, setStreamUp] = useState(false);

  const loading = !ready;

  /* The server decides which district this officer owns, so the client never
     sends one and can never be shown someone else's work. */
  useEffect(() => {
    if (!district) return;

    let cancelled = false;

    fetchIncidents(token)
      .then((result) => {
        if (cancelled) return;

        setError(null);
        setIncidents(result.slice().sort(deskOrder));
        setNow(Date.now());
      })
      .catch((loadError: Error) => {
        if (!cancelled) setError(loadError.message || "The desk could not be read.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, district, tick]);

  /* The district's live feed: a team leader tapping a stage on their phone
     arrives here in about a second, which is the point of the whole feature —
     the control room watches the mission move instead of asking over the radio. */
  useEffect(() => {
    if (!district) return;

    const handle = openDispatchStream({
      token,
      onEvent: (event) => {
        if (event.kind === "hello") return;

        setLiveFeed(event.message ?? "Something on the district moved.");
        setTick((value) => value + 1);
      },
      // "connecting" fires inside the effect's own synchronous path, so it is
      // ignored: the pill only ever flips from the settled states.
      onState: (state) => {
        if (state === "connecting") return;

        setStreamUp(state === "live");
      },
    });

    return () => handle.close();
  }, [token, district]);

  // Ageing clocks should keep moving without the officer touching anything.
  useEffect(() => {
    const beat = window.setInterval(() => setNow(Date.now()), 60000);

    return () => window.clearInterval(beat);
  }, []);

  /* A slow safety net under the live feed. If the stream drops and the retry is
     still on its way back, the desk is never more than a minute behind reality. */
  useEffect(() => {
    const net = window.setInterval(() => setTick((value) => value + 1), 60000);

    return () => window.clearInterval(net);
  }, []);

  const refresh = () => {
    setReady(false);
    setError(null);
    setTick((value) => value + 1);
  };

  const counts = useMemo(() => {
    const byStage: Record<DeskStage, number> = {
      needs_acceptance: 0,
      awaiting_team: 0,
      working: 0,
      wrapped: 0,
      closed: 0,
    };

    for (const incident of incidents) byStage[stageOf(incident)] += 1;

    return byStage;
  }, [incidents]);

  const stale = useMemo(
    () =>
      incidents.filter(
        (incident) => stageOf(incident) !== "closed" && isStale(incident, now)
      ).length,
    [incidents, now]
  );

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return incidents
      .filter((incident) => filter === "all" || stageOf(incident) === filter)
      .filter((incident) =>
        needle === ""
          ? true
          : [
              incident.reportId,
              incident.hazardType,
              incident.landmark ?? "",
              incident.description,
              incident.reporterName ?? "",
              incident.acceptedByName ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(needle)
      );
  }, [incidents, filter, query]);

  const takeOn = async (incident: IncidentSummary) => {
    setBusyId(incident.id);
    setActionError(null);
    setNotice(null);

    try {
      const accepted = await acceptIncident(token, incident.reportId);

      setNotice(
        `${accepted.reportId} is on the ${accepted.locationDistrict} desk now${
          accepted.acceptedByName ? `, taken on by ${accepted.acceptedByName}` : ""
        }. Add the handover note when you open it.`
      );
      setTick((value) => value + 1);
    } catch (acceptError) {
      setActionError(
        acceptError instanceof DispatchApiError
          ? acceptError.message
          : acceptError instanceof Error
            ? acceptError.message
            : "The acceptance could not be recorded."
      );
    } finally {
      setBusyId(null);
    }
  };

  const FilterIcon = FILTER_ICONS[filter];

  return (
    <div className="kdx-stack">
      <div className="kqd-head">
        <div>
          <div className="kqd-head-title">
            <ShieldCheck size={17} />
            {district || "Your district"} incident desk
          </div>
          <div className="kqd-head-sub">
            Only incidents the DMC has verified reach this screen. Whether the report is
            true was decided upstairs — here you take it on for your district and open it
            to send a team.
          </div>
        </div>

        <div className="kqd-head-stats">
          <span
            className={`kqd-live ${streamUp ? "kqd-live-on" : ""}`}
            title={
              streamUp
                ? "Connected to the district's live feed. A stage the leader taps on their phone appears here at once."
                : "The live feed is reconnecting. The list still refreshes once a minute."
            }
          >
            <Radio size={11} />
            {streamUp ? "Live" : "Refreshing"}
          </span>
          <span className="kqd-stat">
            <strong>{incidents.length}</strong>
            <span>on the desk</span>
          </span>
          <span className={`kqd-stat ${counts.needs_acceptance > 0 ? "kqd-stat-hot" : ""}`}>
            <strong>{counts.needs_acceptance}</strong>
            <span>need your yes</span>
          </span>
          <span className={`kqd-stat ${counts.working > 0 ? "kqd-stat-live" : ""}`}>
            <strong>{counts.working}</strong>
            <span>teams out</span>
          </span>
          <span className={`kqd-stat ${stale > 0 ? "kqd-stat-hot" : ""}`}>
            <strong>{stale}</strong>
            <span>over 24 h</span>
          </span>
        </div>
      </div>

      {/* What just happened, said out loud. A board that updates silently makes
          an officer doubt it; one line of proof is worth more than a spinner. */}
      {liveFeed && (
        <div className="kqd-flash">
          <Radio size={13} />
          <span>{liveFeed}</span>
          <button
            type="button"
            className="kdx-btn kdx-btn-sm"
            onClick={() => setLiveFeed(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="kdx-error">
          <TriangleAlert size={16} />
          <span>{error}</span>
          <button type="button" className="kdx-btn kdx-btn-sm" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div className="kdx-success">
          <CheckCircle2 size={15} />
          <span>{notice}</span>
        </div>
      )}

      {actionError && (
        <div className="kdx-error">
          <TriangleAlert size={16} />
          <span>{actionError}</span>
          <button
            type="button"
            className="kdx-btn kdx-btn-sm"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {!district ? (
        <div className="kdx-panel">
          <div className="kdx-empty">
            <ShieldCheck size={26} />
            <span>
              Your account has no assigned district, so there is no incident desk to
              read. Ask a Super Admin to complete your assignment.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="kdx-tabs">
            {FILTERS.map((item) => {
              const ItemIcon = FILTER_ICONS[item.key];
              const count =
                item.key === "all" ? incidents.length : counts[item.key as DeskStage];

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`kdx-tab ${filter === item.key ? "kdx-tab-on" : ""}`}
                  onClick={() => setFilter(item.key)}
                >
                  <ItemIcon size={13} />
                  {item.label}
                  <span className="kdx-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          <section className="kdx-panel">
            <div className="kdx-panel-head">
              <span className="kdx-panel-title">
                <FilterIcon size={15} />
                {FILTERS.find((item) => item.key === filter)?.hint}
              </span>
              <button
                type="button"
                className="kdx-btn kdx-btn-sm"
                onClick={refresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={13} className="kdx-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Refresh
              </button>
            </div>

            <div className="kdx-panel-body">
              <input
                className="kdx-input"
                placeholder="Filter by code, hazard, landmark, reporter…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              {loading ? (
                <div className="kdx-loading">
                  <Loader2 size={16} className="kdx-spin" /> Reading the district's
                  verified incidents…
                </div>
              ) : searched.length === 0 ? (
                <div className="kdx-empty">
                  <CheckCircle2 size={26} />
                  <span>
                    {query.trim()
                      ? `Nothing on the desk matches “${query.trim()}”.`
                      : filter === "needs_acceptance"
                        ? "Every verified incident has been taken on by the district."
                        : filter === "awaiting_team"
                          ? "Nothing accepted is sitting without a team."
                          : filter === "working"
                            ? "No rescue team is in the field on your incidents right now."
                            : filter === "wrapped"
                              ? "Nothing is waiting to be closed. Every incident with a team out is still running."
                              : filter === "closed"
                                ? "You have not closed an incident yet. Open one and shut it once its teams are back."
                                : "No verified incident has reached your district. Citizen reports are verified by the DMC officer first."}
                  </span>
                </div>
              ) : (
                <div className="kqd-queue">
                  {searched.map((incident) => (
                    <DeskCard
                      key={incident.id}
                      incident={incident}
                      now={now}
                      busy={busyId === incident.id}
                      onOpen={() => onOpenIncident(incident.reportId)}
                      onTakeOn={() => void takeOn(incident)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <p className="kdx-hint">
            <MapPin size={13} />
            A card with no map point can be taken on but not tasked — open it and call the
            reporter, so the location is saved on the report before a team is sent.
          </p>
        </>
      )}

      <style>{`${DISPATCH_CSS}${DESK_CSS}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One verified incident, as the queue shows it.
 * ------------------------------------------------------------------ */
function DeskCard({
  incident,
  now,
  busy,
  onOpen,
  onTakeOn,
}: {
  incident: IncidentSummary;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onTakeOn: () => void;
}) {
  const stage = stageOf(incident);
  const meta = STAGE_META[stage];
  const closed = stage === "closed";
  const wrapped = stage === "wrapped";
  const point =
    typeof incident.locationLat === "number" &&
    typeof incident.locationLng === "number" &&
    Number.isFinite(incident.locationLat) &&
    Number.isFinite(incident.locationLng);
  const stale = !closed && isStale(incident, now);

  return (
    <article className={`kqd-card ${stale ? "kqd-card-stale" : ""} ${closed ? "kqd-card-closed" : ""}`}>
      <span className="kqd-rail" style={{ background: severityColor(incident.severityLevel) }} />

      {/* Clicking the incident itself is what opens it, exactly as an officer
          expects from a queue: the two buttons on the right are the only other
          things worth pressing from here. */}
      <button
        type="button"
        className="kqd-open"
        onClick={onOpen}
        title={
          closed
            ? `Read ${incident.reportId} — it is closed, and still auditable`
            : wrapped
              ? `Open ${incident.reportId} to review the missions and close the incident`
              : `Open ${incident.reportId} to task a team`
        }
      >
        <span className={`kqd-shot ${incident.liveDispatchCount > 0 ? "kqd-shot-live" : ""}`}>
          {incident.thumbnailUrl ? (
            <img src={incident.thumbnailUrl} alt="" />
          ) : (
            <Camera size={18} />
          )}
          {incident.photoCount > 0 && (
            <span className="kqd-shot-tag">{incident.photoCount}</span>
          )}
        </span>

        <div className="kqd-main">
          <div className="kqd-top">
            <span className="kqd-title">{humanizeHazard(incident.hazardType)}</span>
            <span
              className="kqd-sev"
              style={{
                background: `${severityColor(incident.severityLevel)}1A`,
                color: severityColor(incident.severityLevel),
              }}
            >
              {incident.severityLevel}
            </span>
            {incident.immediateDanger && (
              <span className="kqd-danger">
                <TriangleAlert size={10} />
                Danger to life
              </span>
            )}
            <span
              className="kqd-stage"
              style={{ color: meta.color, borderColor: meta.color }}
            >
              {meta.label}
            </span>
          </div>

          <div className="kqd-meta">
            {incident.reportId} · verified {relativeTime(incident.verifiedAt)}
            {incident.verifiedByName ? ` by ${incident.verifiedByName}` : ""}
          </div>

          <div className="kqd-place">
            {incident.landmark || incident.description.slice(0, 130)}
          </div>

          <div className="kdx-chip-row">
            {!point && (
              <span className="kdx-chip kdx-chip-warn">
                <MapPin size={10} />
                no map point
              </span>
            )}
            {typeof incident.affectedPopulation === "number" && (
              <span className="kdx-chip">
                <Users size={10} />
                {incident.affectedPopulation} affected
              </span>
            )}
            {incident.dispatchCount ? (
              <span className="kdx-chip">
                <Navigation size={10} />
                {incident.dispatchCount} mission{incident.dispatchCount === 1 ? "" : "s"}
                {incident.liveDispatchCount > 0
                  ? ` · ${incident.liveDispatchCount} live`
                  : ""}
              </span>
            ) : null}
            {incident.acceptedByName && (
              <span className="kdx-chip kdx-chip-good">
                <ShieldCheck size={10} />
                {incident.acceptedByName}
              </span>
            )}
            {/* The two states that only exist because the district can close a
                job: what came of it, and what is waiting on that closure. */}
            {closed && (
              <span className="kdx-chip kdx-chip-good">
                <CheckCircle2 size={10} />
                {incident.totalRescued} rescued · {incident.totalEvacuated} evacuated
              </span>
            )}
            {wrapped && (
              <span className="kdx-chip kdx-chip-warn">
                <Clock size={10} />
                all teams back — can be closed
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="kqd-side">
        <span className={`kqd-age ${stale ? "kqd-age-hot" : ""}`}>
          <Clock size={11} />
          {closed
            ? `closed ${relativeTime(incident.resolvedAt)}`
            : waitingSince(incident, now)}
        </span>

        {stage === "needs_acceptance" && (
          <button
            type="button"
            className="kdx-btn kdx-btn-sm"
            disabled={busy}
            onClick={onTakeOn}
            title="Take this incident onto your district's desk"
          >
            {busy ? <Loader2 size={13} className="kdx-spin" /> : <ShieldCheck size={13} />}
            Take it on
          </button>
        )}

        <button type="button" className="kdx-btn kdx-btn-task kdx-btn-sm" onClick={onOpen}>
          Open
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}
