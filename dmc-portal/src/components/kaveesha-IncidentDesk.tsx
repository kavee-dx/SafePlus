import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import { DISASTER_KINDS } from "../constants/kaveesha-disasterKinds";
import {
  type IncidentSummary,
  DispatchApiError,
  acceptIncident,
  closeIncident,
  fetchIncidents,
  openDispatchStream,
} from "../services/kaveesha-dispatchApi";
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

const STAGE_META: Record<
  DeskStage,
  { label: string; caption: string; color: string; soft: string }
> = {
  needs_acceptance: {
    label: "Needs your yes",
    caption: "Needs a yes",
    color: Colors.amber,
    soft: "#FFF7EA",
  },
  awaiting_team: {
    label: "Taken on, no team",
    caption: "No team yet",
    color: Colors.blue,
    soft: "#EEF5FF",
  },
  /* A team out in the district is the same fact the rescue board draws in violet
     for "on deployment", so the two screens say it in one colour. */
  working: {
    label: "Team in the field",
    caption: "Teams out",
    color: "#5B4FD6",
    soft: "#F1EFFF",
  },
  wrapped: {
    label: "Teams back · not closed",
    caption: "Teams back",
    color: "#8C99AD",
    soft: "#F3F6F9",
  },
  closed: {
    label: "Closed",
    caption: "Closed",
    color: Colors.success,
    soft: "#ECFDF3",
  },
};

/* The order the meter paints, which is the order the queue is worked in. */
const STAGE_ORDER: DeskStage[] = [
  "needs_acceptance",
  "awaiting_team",
  "working",
  "wrapped",
  "closed",
];

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

/* Numerals are set apart from the prose the way the rescue board sets them: a
   count that lines up in a column is a count that can be compared. */
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const fmt = new Intl.NumberFormat();

/** "1 incident" / "3 incidents" — a count that writes its own plural. */
function plural(count: number, word: string): string {
  return `${fmt.format(count)} ${word}${count === 1 ? "" : "s"}`;
}

/** A share of the queue, clamped so a zero stage stays a zero-wide segment. */
function shareOf(part: number, whole: number): string {
  return `${whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0}%`;
}

/**
 * The icon a hazard is drawn with on this desk. Incidents are verified hazard
 * reports, so they carry the citizen's own hazard code; the rescue board's
 * disaster list is the one place the portal knows those codes and their icons.
 * A code it does not hold (a heatwave, a storm surge) is drawn as a warning
 * rather than guessed at, because inventing an icon is inventing a fact.
 */
function hazardGlyph(code: string): LucideIcon {
  return (
    DISASTER_KINDS.find((kind) => kind.code === code.toUpperCase())?.icon ??
    TriangleAlert
  );
}

/**
 * Renders an icon chosen at render time. Keeping the tag inside a stable
 * component stops React from treating a looked-up icon as a new component on
 * every render.
 */
function Glyph({ icon: Icon, size = 16 }: { icon: LucideIcon; size?: number }) {
  return <Icon size={size} />;
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

  /* The open incident that has been waiting longest is no longer surfaced as a
     hero figure; the ledger rail carries the whole shape of the queue instead. */

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

  /* The district wraps up an incident straight from its card. Only offered once
     every team is back (the "wrapped" stage), which is exactly when a closing
     note is not required — a team did go out — so one tap is honest and safe. */
  const closeNow = async (incident: IncidentSummary) => {
    setBusyId(incident.id);
    setActionError(null);
    setNotice(null);

    try {
      const finished = await closeIncident(token, incident.reportId);

      setNotice(
        `${finished.reportId} is closed for ${finished.locationDistrict}. ${finished.totalRescued} rescued · ${finished.totalEvacuated} evacuated — kept on the desk as finished work.`
      );
      setTick((value) => value + 1);
    } catch (closeError) {
      setActionError(
        closeError instanceof DispatchApiError
          ? closeError.message
          : closeError instanceof Error
            ? closeError.message
            : "The incident could not be closed."
      );
    } finally {
      setBusyId(null);
    }
  };

  const FilterIcon = FILTER_ICONS[filter];

  return (
    <div className="kdesk">
      {/* No heading in this band: the bar above already names the page and says
          what it is for. What the band states instead is what only it can know —
          which district is being read, how much is on it, and whether the numbers
          in front of the officer are moving or twenty seconds old. */}
      <section className="kdesk-hero">
        <div className="kdesk-hero-head">
          <span className="kdesk-medallion">
            <ShieldCheck size={19} />
          </span>
          <p className="kdesk-status">
            <span
              className={`kdesk-live ${streamUp ? "kdesk-live-on" : ""}`}
              aria-hidden="true"
            />
            {district ? (
              <>
                <strong>{district} desk</strong> ·{" "}
                {ready ? plural(incidents.length, "verified incident") : "reading the queue"} ·{" "}
                {streamUp
                  ? "the feed is live"
                  : "the feed is reconnecting — the list still refreshes each minute"}
              </>
            ) : (
              "No district is assigned to this account yet"
            )}
          </p>
          <button
            type="button"
            className="kdesk-refresh"
            onClick={refresh}
            disabled={loading}
            title="Read the queue again"
          >
            <RefreshCw size={14} className={loading ? "kdesk-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {district && (
          <div className="kdesk-controls">
            <div className="kdesk-filters" role="group" aria-label="Incident stage">
              {FILTERS.map((item) => {
                const ItemIcon = FILTER_ICONS[item.key];
                const count =
                  item.key === "all"
                    ? incidents.length
                    : counts[item.key as DeskStage];

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`kdesk-filter ${
                      filter === item.key ? "kdesk-filter-on" : ""
                    }`}
                    onClick={() => setFilter(item.key)}
                    aria-pressed={filter === item.key}
                    title={item.hint}
                  >
                    <ItemIcon size={13} />
                    <span>{item.label}</span>
                    <em>{count}</em>
                  </button>
                );
              })}
            </div>

            <div className="kdesk-search">
              <Search size={14} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by code, hazard, landmark or reporter"
                aria-label="Filter incidents"
              />
              {query && (
                <button
                  type="button"
                  className="kdesk-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear the filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {ready && incidents.length > 0 && (
          /* The whole shape of the desk in one strip. Four figures the officer
             reads across, each lit only by what it is waiting on, so the state of
             the district is taken in at a glance rather than counted down a list. */
          <div className="kdesk-hero-body">
            <div className="kdesk-rail">
              <DeskCell
                icon={Inbox}
                figure={incidents.length}
                caption="On the desk"
                sub="verified by the DMC"
              />
              <DeskCell
                icon={ShieldCheck}
                figure={counts.needs_acceptance}
                caption="Needs your yes"
                sub={
                  counts.needs_acceptance > 0
                    ? "nobody has taken them"
                    : "all taken on"
                }
                tone={counts.needs_acceptance > 0 ? "hot" : "plain"}
              />
              <DeskCell
                icon={Navigation}
                figure={counts.working}
                caption="Teams out"
                sub={counts.wrapped > 0 ? `${counts.wrapped} back, unclosed` : "none waiting to close"}
                tone={counts.working > 0 ? "live" : "plain"}
              />
              <DeskCell
                icon={Clock}
                figure={stale}
                caption="Over 24 hours"
                sub={stale > 0 ? "still open" : "nothing has aged out"}
                tone={stale > 0 ? "hot" : "plain"}
              />
            </div>
          </div>
        )}

        {ready && incidents.length > 0 && (
          /* The shape of the queue in one strip: five stages, painted in the
             colours the cards use, so the bar and the list underneath agree. */
          <div className="kdesk-shape" aria-hidden="true">
            <div className="kdesk-shape-bar">
              {STAGE_ORDER.map((stage) => (
                <span
                  key={stage}
                  className="kdesk-shape-seg"
                  style={{
                    width: `calc(${shareOf(counts[stage], incidents.length)} - 2px)`,
                    background: STAGE_META[stage].color,
                  }}
                />
              ))}
            </div>
            <div className="kdesk-shape-key">
              {STAGE_ORDER.map((stage) => (
                <span key={stage}>
                  <i style={{ background: STAGE_META[stage].color }} />
                  {STAGE_META[stage].caption}
                  <b>{counts[stage]}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {!ready && district && (
          /* The band is built before the queue exists: placeholder bars where the
             focus figure and the ledger will land, so nothing jumps when the
             incidents arrive. */
          <div className="kdesk-skeleton" aria-hidden="true">
            {[0, 1, 2, 3].map((key) => (
              <span key={key} className="kdesk-skeleton-cell">
                <i />
                <em />
                <b />
              </span>
            ))}
          </div>
        )}
      </section>

      {/* What just happened, said out loud. A board that updates silently makes
          an officer doubt it; one line of proof is worth more than a spinner. */}
      {liveFeed && (
        <div className="kdesk-flash">
          <Radio size={14} />
          <span>{liveFeed}</span>
          <button
            type="button"
            className="kdesk-flash-clear"
            onClick={() => setLiveFeed(null)}
            aria-label="Dismiss this line"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {error && (
        <div className="kdesk-banner kdesk-banner-bad">
          <TriangleAlert size={16} />
          <div>
            <strong>The desk could not be read</strong>
            <span>{error}</span>
          </div>
          <button type="button" className="kdesk-btn" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div className="kdesk-banner kdesk-banner-good">
          <CheckCircle2 size={16} />
          <div>
            <strong>Taken on</strong>
            <span>{notice}</span>
          </div>
          <button
            type="button"
            className="kdesk-banner-clear"
            onClick={() => setNotice(null)}
            aria-label="Dismiss this line"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="kdesk-banner kdesk-banner-bad">
          <TriangleAlert size={16} />
          <div>
            <strong>That did not go through</strong>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="kdesk-banner-clear"
            onClick={() => setActionError(null)}
            aria-label="Dismiss this line"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {!district ? (
        <section className="kdesk-panel">
          <div className="kdesk-empty">
            <span className="kdesk-empty-ico">
              <ShieldCheck size={20} />
            </span>
            <h3>No district to read</h3>
            <p>
              An incident desk belongs to a district. Your account has none, so
              there is no queue to open. Ask a Super Admin to complete your
              assignment.
            </p>
          </div>
        </section>
      ) : (
        <section className="kdesk-panel">
          <div className="kdesk-panel-head">
            <h3 className="kdesk-panel-title">
              <FilterIcon size={14} />
              {FILTERS.find((item) => item.key === filter)?.hint}
            </h3>
            <span className="kdesk-panel-count">
              {fmt.format(searched.length)}
              {searched.length !== incidents.length
                ? ` of ${fmt.format(incidents.length)}`
                : ""}{" "}
              {searched.length === 1 ? "incident" : "incidents"}
            </span>
          </div>

          <div className="kdesk-panel-body">
            {loading ? (
              <div className="kdesk-loading">
                <Loader2 size={16} className="kdesk-spin" />
                Reading the district's verified incidents…
              </div>
            ) : searched.length === 0 ? (
              <div className="kdesk-empty">
                <span className="kdesk-empty-ico">
                  {query.trim() ? (
                    <Search size={20} />
                  ) : filter === "closed" ? (
                    <Clock size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </span>
                <h3>
                  {query.trim()
                    ? `Nothing on the desk matches “${query.trim()}”`
                    : filter === "all"
                      ? "The desk is clear"
                      : STAGE_META[filter as DeskStage].label}
                </h3>
                <p>
                  {query.trim()
                    ? "Search reads the code, the hazard, the landmark, the description and who reported it."
                    : filter === "needs_acceptance"
                      ? "Every verified incident has been taken on by the district."
                      : filter === "awaiting_team"
                        ? "Nothing the district has taken on is sitting without a team."
                        : filter === "working"
                          ? "No rescue team is in the field on your incidents right now."
                          : filter === "wrapped"
                            ? "Nothing is waiting to be closed. Every incident that had a team out has been shut."
                            : filter === "closed"
                              ? "You have not closed an incident yet. Open one and shut it once its teams are back."
                              : "No verified incident has reached your district. A citizen's report is verified by a DMC officer before it appears here."}
                </p>
                {query.trim() && (
                  <button
                    type="button"
                    className="kdesk-ghost"
                    onClick={() => setQuery("")}
                  >
                    <X size={13} />
                    Clear the filter
                  </button>
                )}
              </div>
            ) : (
              <div className="kdesk-queue">
                {searched.map((incident) => (
                  <DeskCard
                    key={incident.id}
                    incident={incident}
                    now={now}
                    busy={busyId === incident.id}
                    onOpen={() => onOpenIncident(incident.reportId)}
                    onTakeOn={() => void takeOn(incident)}
                    onClose={() => void closeNow(incident)}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="kdesk-hint">
            <MapPin size={13} />
            A card with no map point can be taken on but not tasked — open it and
            call the reporter, so the location is saved on the report before a
            team is sent.
          </p>
        </section>
      )}

      {/* The stylesheet travels with the view rather than landing in the app's
          global CSS, so this page can be restated without touching the shared
          dispatch styles the shelter screens read too. */}
      <style>{DESK_STYLES}</style>
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
  onClose,
}: {
  incident: IncidentSummary;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onTakeOn: () => void;
  onClose: () => void;
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
  const severity = severityColor(incident.severityLevel);
  const label = humanizeHazard(incident.hazardType);

  return (
    <article
      className={`kdesk-card ${stale ? "kdesk-card-stale" : ""} ${
        closed ? "kdesk-card-closed" : ""
      }`}
    >
      {/* The picture and the words together are the incident: clicking anywhere
          on them opens the response page, which is what a hand reaching for a
          card expects. The stage and the two actions stay outside this strip. */}
      <button
        type="button"
        className="kdesk-open"
        onClick={onOpen}
        title={
          closed
            ? `Read ${incident.reportId} — it is closed, and still auditable`
            : wrapped
              ? `Open ${incident.reportId} to review the missions and close the incident`
              : `Open ${incident.reportId} to task a team`
        }
      >
        {/* The scene is the first thing an officer wants, and it is the one thing
            on this card that cannot be said in words, so it is given a panel of
            its own rather than a thumbnail beside the text. */}
        <span
          className={`kdesk-shot ${
            incident.liveDispatchCount > 0 ? "kdesk-shot-live" : ""
          }`}
        >
          {incident.thumbnailUrl ? (
            <img src={incident.thumbnailUrl} alt="" loading="lazy" />
          ) : (
            <span className="kdesk-shot-none">
              <Glyph icon={hazardGlyph(incident.hazardType)} size={21} />
              <b>{label}</b>
              <small>No photo on the report</small>
            </span>
          )}

          {/* The severity lives on the edge between the scene and its account,
              so the rail and the picture are read as one object. */}
          <span className="kdesk-shot-sev" style={{ background: severity }} />

          {incident.photoCount > 0 && (
            <span className="kdesk-shot-tag">
              <Camera size={10} />
              {incident.photoCount}
            </span>
          )}

          {incident.liveDispatchCount > 0 && (
            <span className="kdesk-shot-out">
              <i />
              {incident.liveDispatchCount} in the field
            </span>
          )}
        </span>

        <span className="kdesk-main">
          <span className="kdesk-top">
            <strong className="kdesk-title">{label}</strong>
            <span
              className="kdesk-sev"
              style={{ background: `${severity}1A`, color: severity }}
            >
              {incident.severityLevel}
            </span>
            {incident.immediateDanger && (
              <span className="kdesk-danger">
                <TriangleAlert size={10} />
                Danger to life
              </span>
            )}
          </span>

          <span className="kdesk-meta">
            <span className="kdesk-code">{incident.reportId}</span>
            {" · verified "}
            {relativeTime(incident.verifiedAt)}
            {incident.verifiedByName ? ` by ${incident.verifiedByName}` : ""}
          </span>

          <span className="kdesk-place">
            {incident.landmark || incident.description.slice(0, 180)}
          </span>

          <span className="kdesk-chips">
            {!point && (
              <span className="kdesk-chip kdesk-chip-warn">
                <MapPin size={10} />
                no map point
              </span>
            )}
            {typeof incident.affectedPopulation === "number" && (
              <span className="kdesk-chip">
                <Users size={10} />
                {fmt.format(incident.affectedPopulation)} affected
              </span>
            )}
            {incident.dispatchCount ? (
              <span className="kdesk-chip">
                <Navigation size={10} />
                {plural(incident.dispatchCount, "mission")}
                {incident.liveDispatchCount > 0
                  ? ` · ${incident.liveDispatchCount} live`
                  : ""}
              </span>
            ) : null}
            {incident.acceptedByName && (
              <span className="kdesk-chip kdesk-chip-good">
                <ShieldCheck size={10} />
                {incident.acceptedByName}
              </span>
            )}
            {/* The two states that only exist because the district can close a
                job: what came of it, and what is waiting on that closure. */}
            {closed && (
              <span className="kdesk-chip kdesk-chip-good">
                <CheckCircle2 size={10} />
                {incident.totalRescued} rescued · {incident.totalEvacuated}{" "}
                evacuated
              </span>
            )}
            {wrapped && (
              <span className="kdesk-chip kdesk-chip-warn">
                <Clock size={10} />
                all teams back — can be closed
              </span>
            )}
          </span>
        </span>
      </button>

      <div className="kdesk-side">
        <span
          className="kdesk-stage"
          style={{ color: meta.color, background: meta.soft }}
        >
          {meta.label}
        </span>

        <span className={`kdesk-age ${stale ? "kdesk-age-hot" : ""}`}>
          <Clock size={11} />
          {closed
            ? `closed ${relativeTime(incident.resolvedAt)}`
            : waitingSince(incident, now)}
        </span>

        <span className="kdesk-actions">
          {stage === "needs_acceptance" && (
            <button
              type="button"
              className="kdesk-btn kdesk-btn-take"
              disabled={busy}
              onClick={onTakeOn}
              title="Take this incident onto your district's desk"
            >
              {busy ? (
                <Loader2 size={13} className="kdesk-spin" />
              ) : (
                <ShieldCheck size={13} />
              )}
              Take it on
            </button>
          )}

          {wrapped && (
            <button
              type="button"
              className="kdesk-btn kdesk-btn-close"
              disabled={busy}
              onClick={onClose}
              title="Wrap this incident up — every team is back"
            >
              {busy ? (
                <Loader2 size={13} className="kdesk-spin" />
              ) : (
                <Lock size={13} />
              )}
              Close incident
            </button>
          )}

          <button
            type="button"
            className="kdesk-btn kdesk-btn-open"
            onClick={onOpen}
          >
            Open
            <ArrowRight size={13} />
          </button>
        </span>
      </div>
    </article>
  );
}

/**
 * One figure of the desk's ledger. Deliberately not a boxed stat tile: these are
 * read across against each other, so they share a hairline and a baseline, and
 * only the small mark is coloured by the tone so the rail never becomes a wall
 * of alarms while the figure itself stays the navy every numeral is drawn in.
 */
function DeskCell({
  icon,
  figure,
  caption,
  sub,
  tone = "plain",
}: {
  icon: LucideIcon;
  figure: number;
  caption: string;
  sub: string;
  tone?: "plain" | "hot" | "live";
}) {
  return (
    <div className={`kdesk-cell${tone !== "plain" ? ` kdesk-cell-${tone}` : ""}`}>
      <span className="kdesk-cell-ico">
        <Glyph icon={icon} size={13} />
      </span>
      <span className="kdesk-cell-figure">{fmt.format(figure)}</span>
      <span className="kdesk-cell-caption">{caption}</span>
      <span className="kdesk-cell-sub">{sub}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const DESK_STYLES = `
  /* One page, one voice: white panels on the app's own grey, separated by
     hairlines rather than boxed apart. Radii stay at 12/16 so nothing here reads
     as a 24px pill, and every numeral is monospaced so a column can be compared
     at a glance. */
  .kdesk {
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: kdesk-rise 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }

  @keyframes kdesk-rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  .kdesk-hero,
  .kdesk-panel {
    border: 1px solid #e3e8ef;
    border-radius: 16px;
    background: ${Colors.white};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 14px 30px -18px rgba(11, 31, 51, 0.16);
  }

  .kdesk-hero { padding: 18px 20px; }

  .kdesk-hero-head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .kdesk-medallion {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 12px;
    background: linear-gradient(150deg, ${Colors.navyLight}, ${Colors.navy});
    color: ${Colors.white};
    box-shadow: 0 6px 14px -8px rgba(11, 31, 51, 0.6);
  }

  .kdesk-status {
    flex: 1;
    min-width: 220px;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.5;
    color: ${Colors.muted};
  }

  .kdesk-status strong { color: ${Colors.navy}; font-weight: 800; }

  .kdesk-live {
    position: relative;
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 999px;
    background: #cfd6df;
  }

  .kdesk-live-on { background: ${Colors.success}; }

  /* A ring that breathes while the feed is held open: proof that the board is
     being pushed, not merely being looked at. */
  .kdesk-live-on::after {
    content: "";
    position: absolute;
    inset: -4px;
    border: 1px solid ${Colors.success};
    border-radius: 999px;
    animation: kdesk-pulse 2400ms ease-out infinite;
  }

  @keyframes kdesk-pulse {
    0% { opacity: 0.55; transform: scale(0.7); }
    70% { opacity: 0; transform: scale(1.25); }
    100% { opacity: 0; transform: scale(1.25); }
  }

  .kdesk-refresh {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border: 1px solid #e3e8ef;
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
  }

  .kdesk-refresh:hover:not(:disabled) {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
    background: #f6f9ff;
  }

  .kdesk-refresh:disabled { opacity: 0.6; cursor: default; }

  .kdesk-spin { animation: kdesk-rotate 900ms linear infinite; }

  @keyframes kdesk-rotate { to { transform: rotate(360deg); } }

  .kdesk-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #eef1f5;
  }

  /* Six stages is too many for a segmented switch and too few for a dropdown,
     so they are chips: the count each one holds is written on it, and the chosen
     one is the only chip wearing the navy. */
  .kdesk-filters {
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
    flex: 1 1 auto;
    min-width: 0;
    /* Bounded to its container on every layout. Without a max width the nowrap
       chip row reports its intrinsic width (all six chips) and pushes past the
       card on narrow screens; capped here, overflow-x turns it into a strip that
       scrolls inside itself instead of widening the page. */
    max-width: 100%;
    /* Six chips on one line: the row may overflow on a narrow desk, so it scrolls
       sideways instead of dropping "Closed" onto a second line. */
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .kdesk-filters::-webkit-scrollbar { display: none; }

  .kdesk-filter { flex: 0 0 auto; }

  .kdesk-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px;
    border: 1px solid #e3e8ef;
    border-radius: 999px;
    background: #f8fafc;
    color: ${Colors.muted};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 750;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
  }

  .kdesk-filter em {
    font-family: ${Mono};
    font-size: 10.5px;
    font-weight: 700;
    font-style: normal;
    padding: 1px 6px;
    border-radius: 999px;
    background: #eaeef4;
    color: ${Colors.navy};
  }

  /* The hover may not reach the chosen chip. A hover selector outranks a plain
     class, so an unfenced rule would write navy letters over the navy pill and
     blank the chip under the cursor. */
  .kdesk-filter:not(.kdesk-filter-on):hover {
    border-color: ${Colors.border};
    background: ${Colors.white};
    color: ${Colors.navy};
  }

  .kdesk-filter-on {
    border-color: ${Colors.navy};
    /* Flat navy reads as black at chip size, so the selected filter is lit the
       same way the rescue board lights its chosen disaster. */
    background: linear-gradient(165deg, ${Colors.navyLight}, ${Colors.navy});
    color: ${Colors.white};
    box-shadow: 0 2px 6px rgba(11, 31, 51, 0.2);
  }

  .kdesk-filter-on em { background: rgba(255, 255, 255, 0.18); color: ${Colors.white}; }

  .kdesk-filter-on:hover {
    border-color: #1c4670;
    background: linear-gradient(165deg, #1d4a70, ${Colors.navy});
    box-shadow: 0 5px 12px -4px rgba(11, 31, 51, 0.34);
  }

  .kdesk-search {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 1 300px;
    min-width: 200px;
    padding: 0 11px;
    border: 1px solid #e3e8ef;
    border-radius: 11px;
    background: ${Colors.white};
    color: #98a2b3;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  .kdesk-search:focus-within {
    border-color: ${Colors.blue};
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.14);
  }

  .kdesk-search input {
    flex: 1;
    min-width: 0;
    padding: 9px 0;
    border: none;
    background: transparent;
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    outline: none;
  }

  .kdesk-search input::placeholder { color: #98a2b3; font-weight: 600; }

  .kdesk-search-clear {
    display: grid;
    place-items: center;
    width: 21px;
    height: 21px;
    flex-shrink: 0;
    border: none;
    border-radius: 7px;
    background: #eef1f5;
    color: ${Colors.muted};
    cursor: pointer;
  }

  .kdesk-search-clear:hover { background: ${Colors.border}; color: ${Colors.navy}; }

  /* The ledger reads across, not down: four figures sharing one bordered strip,
     each marked by an icon and lit only where the district is waiting on it. It
     took the place of the old hero figure so the whole shape of the desk lands
     in a single row the officer can compare at a glance. */
  .kdesk-hero-body {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid #eef1f5;
  }

  .kdesk-rail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid #e9eef4;
    border-radius: 14px;
    background: linear-gradient(180deg, #fbfcfe, #f5f8fc);
    overflow: hidden;
  }

  .kdesk-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 15px 17px;
    border-left: 1px solid #eef1f5;
    min-width: 0;
  }

  .kdesk-cell:first-child { border-left: none; }

  .kdesk-cell-ico {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    margin-bottom: 5px;
    border-radius: 9px;
    background: #eaeef4;
    color: #64748b;
  }

  .kdesk-cell-figure {
    font-family: ${Mono};
    font-size: 26px;
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.035em;
    color: ${Colors.navy};
    font-variant-numeric: tabular-nums;
  }

  .kdesk-cell-caption {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdesk-cell-sub {
    font-size: 10px;
    font-weight: 600;
    color: #98a2b3;
    line-height: 1.4;
  }

  /* A tone colours only the mark and its caption, never the figure, so a district
     waiting on something is signalled without the rail becoming a wall of alarms. */
  .kdesk-cell-hot .kdesk-cell-ico { background: #FFF1E0; color: #B54708; }
  .kdesk-cell-hot .kdesk-cell-caption { color: #B54708; }
  .kdesk-cell-live .kdesk-cell-ico { background: #EFEDFF; color: #5B4FD6; }
  .kdesk-cell-live .kdesk-cell-caption { color: #5B4FD6; }

  /* The shape of the queue: five stages in the colours the cards wear, with the
     counts written under them so the strip needs no legend of its own. */
  .kdesk-shape { margin-top: 16px; }

  .kdesk-shape-bar {
    display: flex;
    gap: 2px;
    height: 7px;
    border-radius: 999px;
    background: #eef1f5;
    overflow: hidden;
  }

  /* Widths arrive as calc percentages, so a stage at zero stays zero wide and the
     gaps come out of each share instead of overflowing the track. */
  .kdesk-shape-seg {
    border-radius: 999px;
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .kdesk-shape-key {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin-top: 9px;
    font-size: 10px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .kdesk-shape-key span { display: inline-flex; align-items: center; gap: 5px; }

  .kdesk-shape-key i { width: 7px; height: 7px; border-radius: 3px; flex-shrink: 0; }

  .kdesk-shape-key b {
    font-family: ${Mono};
    font-weight: 700;
    color: ${Colors.navy};
  }

  /* Held while the queue is being read, in the exact shape of the rail that will
     land, so the page does not jump when the incidents arrive. */
  .kdesk-skeleton {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin-top: 18px;
    border: 1px solid #e9eef4;
    border-radius: 14px;
    background: linear-gradient(180deg, #fbfcfe, #f5f8fc);
    overflow: hidden;
  }

  .kdesk-skeleton-cell {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 15px 17px;
    border-left: 1px solid #eef1f5;
  }

  .kdesk-skeleton-cell:first-child { border-left: none; }

  .kdesk-skeleton-cell i,
  .kdesk-skeleton-cell em,
  .kdesk-skeleton-cell b {
    border-radius: 999px;
    background: linear-gradient(90deg, #eef1f5 25%, #e2e8f0 37%, #eef1f5 63%);
    background-size: 400% 100%;
    animation: kdesk-sheen 1400ms ease-in-out infinite;
  }

  .kdesk-skeleton-cell i { width: 27px; height: 27px; border-radius: 9px; }
  .kdesk-skeleton-cell em { width: 46%; height: 22px; }
  .kdesk-skeleton-cell b { width: 74%; height: 9px; }

  @keyframes kdesk-sheen {
    from { background-position: 100% 0; }
    to { background-position: 0 0; }
  }

  /* One line of proof that the feed moved, worth more than a spinner. */
  .kdesk-flash {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 14px;
    border: 1px solid #cfe0ff;
    border-radius: 12px;
    background: #f4f8ff;
    color: #174ea6;
    font-size: 12px;
    font-weight: 650;
    line-height: 1.5;
  }

  .kdesk-flash svg { flex-shrink: 0; color: ${Colors.blue}; }
  .kdesk-flash span { flex: 1; min-width: 0; }

  .kdesk-flash-clear,
  .kdesk-banner-clear {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border: none;
    border-radius: 7px;
    background: rgba(21, 112, 239, 0.12);
    color: #174ea6;
    cursor: pointer;
  }

  .kdesk-flash-clear:hover { background: rgba(21, 112, 239, 0.22); }

  .kdesk-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.55;
  }

  .kdesk-banner div { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

  .kdesk-banner strong {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .kdesk-banner-bad { border-color: #fdd9d4; background: #fff8f7; color: #91291f; }
  .kdesk-banner-bad svg { flex-shrink: 0; color: ${Colors.red}; }
  .kdesk-banner-bad .kdesk-banner-clear { background: rgba(217, 45, 32, 0.1); color: #91291f; }

  .kdesk-banner-good { border-color: #d8ecdf; background: #f4fcf8; color: #1a7a44; }
  .kdesk-banner-good svg { flex-shrink: 0; color: ${Colors.success}; }

  .kdesk-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .kdesk-panel-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 18px;
    border-bottom: 1px solid #eef1f5;
    background: linear-gradient(180deg, #fbfcfe, #f6f8fb);
  }

  .kdesk-panel-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    font-weight: 750;
    color: ${Colors.navy};
  }

  .kdesk-panel-title svg { flex-shrink: 0; color: ${Colors.blue}; }

  .kdesk-panel-count {
    font-family: ${Mono};
    font-size: 11px;
    font-weight: 700;
    color: ${Colors.muted};
    white-space: nowrap;
  }

  /* The queue sits in a shallow well, so the cards are read as the contents of
     this panel rather than as loose boxes on the page. */
  .kdesk-panel-body {
    padding: 14px 18px 16px;
    background: #fafbfd;
  }

  .kdesk-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 26px 0;
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 650;
  }

  .kdesk-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 34px 20px;
    text-align: center;
  }

  .kdesk-empty-ico {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    margin-bottom: 4px;
    border: 1px solid #e9edf3;
    border-radius: 15px;
    background: ${Colors.white};
    color: #98a2b3;
    box-shadow: 0 6px 16px -12px rgba(11, 31, 51, 0.5);
  }

  .kdesk-empty h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.018em;
    color: ${Colors.navy};
  }

  .kdesk-empty p {
    margin: 0;
    max-width: 56ch;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
    color: ${Colors.muted};
  }

  .kdesk-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 8px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .kdesk-ghost:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .kdesk-hint {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin: 0;
    padding: 11px 18px;
    border-top: 1px solid #eef1f5;
    background: #fffcf5;
    color: ${Colors.amberText};
    font-size: 11px;
    font-weight: 650;
    line-height: 1.55;
  }

  .kdesk-hint svg { flex-shrink: 0; margin-top: 1px; }

  /* --- the queue ------------------------------------------------------- */

  .kdesk-queue {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kdesk-card {
    display: flex;
    align-items: stretch;
    border: 1px solid #e6ebf2;
    border-radius: 16px;
    background: ${Colors.white};
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.03);
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .kdesk-card:hover {
    border-color: ${Colors.border};
    box-shadow: 0 16px 30px -20px rgba(11, 31, 51, 0.34);
    transform: translateY(-1px);
  }

  .kdesk-open {
    display: flex;
    align-items: stretch;
    gap: 16px;
    flex: 1;
    min-width: 0;
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }

  .kdesk-open:focus-visible {
    outline: 2px solid ${Colors.blue};
    outline-offset: -3px;
  }

  /* The scene is the one thing on this card that cannot be said in words, so it
     is painted edge to edge at twice the size a thumbnail was: an officer
     decides whether to open a report from what the picture already shows. */
  .kdesk-shot {
    position: relative;
    display: block;
    flex: 0 0 264px;
    width: 264px;
    height: 178px;
    align-self: center;
    background: #eef2f7;
    overflow: hidden;
  }

  .kdesk-shot img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 460ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .kdesk-card:hover .kdesk-shot img { transform: scale(1.03); }

  /* No photo is stated as a fact about the report, in the report's own hazard
     name, rather than left as an empty grey square. */
  .kdesk-shot-none {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 3px;
    height: 100%;
    padding: 14px;
    background: linear-gradient(160deg, #f1f5f9, #e5ebf3);
    color: #64748b;
  }

  .kdesk-shot-none b {
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
  }

  .kdesk-shot-none small { font-size: 10.5px; font-weight: 700; color: #98a2b3; }

  /* Severity sits on the edge between the scene and the account of it, so the
     rail and the picture are read as one object. */
  .kdesk-shot-sev {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 4px;
  }

  .kdesk-shot-tag {
    position: absolute;
    right: 12px;
    bottom: 10px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(8, 16, 32, 0.66);
    color: ${Colors.white};
    font-family: ${Mono};
    font-size: 10px;
    font-weight: 700;
  }

  .kdesk-shot-out {
    position: absolute;
    left: 10px;
    top: 10px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    background: #5B4FD6;
    color: ${Colors.white};
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.01em;
    box-shadow: 0 4px 10px -4px rgba(11, 31, 51, 0.7);
  }

  .kdesk-shot-out i {
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: ${Colors.white};
    animation: kdesk-blink 1600ms ease-in-out infinite;
  }

  @keyframes kdesk-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .kdesk-shot-live { box-shadow: inset 0 0 0 2px rgba(91, 79, 214, 0.5); }

  .kdesk-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 15px 18px 15px 0;
  }

  .kdesk-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  .kdesk-title {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.022em;
    line-height: 1.2;
    color: ${Colors.navy};
    transition: color 150ms ease;
  }

  .kdesk-open:hover .kdesk-title { color: ${Colors.blue}; }

  .kdesk-sev {
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .kdesk-danger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    background: ${Colors.red};
    color: ${Colors.white};
    font-size: 10px;
    font-weight: 800;
  }

  .kdesk-meta { font-size: 11.5px; font-weight: 600; color: ${Colors.muted}; }

  .kdesk-code { font-family: ${Mono}; font-size: 11px; font-weight: 600; color: #7d8797; }

  .kdesk-place {
    font-size: 13px;
    line-height: 1.55;
    color: ${Colors.text};
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .kdesk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }

  .kdesk-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border: 1px solid #e9edf3;
    border-radius: 8px;
    background: ${Colors.white};
    color: #475467;
    font-size: 10.5px;
    font-weight: 700;
  }

  .kdesk-chip svg { flex-shrink: 0; opacity: 0.75; }

  .kdesk-chip-warn {
    border-color: ${Colors.amberLight};
    background: #fffcf5;
    color: ${Colors.amberText};
  }

  .kdesk-chip-good {
    border-color: #d8ecdf;
    background: #f4fcf8;
    color: #1a7a44;
  }

  /* The stage, the age and the actions in one column of their own. The actions
     are pushed to the bottom so "Open" sits at the same height on every card and
     the list can be worked down the column without aiming. */
  .kdesk-side {
    display: flex;
    flex-direction: column;
    gap: 9px;
    flex: 0 0 174px;
    padding: 15px 16px;
    border-left: 1px solid #eef1f5;
    background: #fbfcfe;
  }

  .kdesk-stage {
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    line-height: 1.35;
  }

  .kdesk-age {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: ${Mono};
    font-size: 11px;
    font-weight: 600;
    color: ${Colors.muted};
  }

  .kdesk-age-hot { color: ${Colors.amberText}; }

  .kdesk-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }

  .kdesk-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid ${Colors.border};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
  }

  .kdesk-banner .kdesk-btn { flex-shrink: 0; }

  .kdesk-btn-take {
    border-color: ${Colors.amber};
    background: #fffcf5;
    color: ${Colors.amberText};
  }

  .kdesk-btn-take:hover:not(:disabled) {
    border-color: ${Colors.amber};
    background: ${Colors.amber};
    color: ${Colors.white};
  }

  .kdesk-btn-take:disabled { opacity: 0.6; cursor: default; }

  /* The closing action is the one that finishes a job, so it is drawn in the
     alert red of a committed, hard-to-undo act — but only when the desk itself
     already says the work is done and every team is back. */
  .kdesk-btn-close {
    border-color: ${Colors.red};
    background: linear-gradient(165deg, ${Colors.red}, ${Colors.redDark});
    color: ${Colors.white};
    box-shadow: 0 2px 6px -2px rgba(217, 45, 32, 0.5);
  }

  .kdesk-btn-close:hover:not(:disabled) {
    border-color: ${Colors.redDark};
    background: linear-gradient(165deg, ${Colors.redDark}, #8f1a12);
    box-shadow: 0 8px 16px -8px rgba(217, 45, 32, 0.6);
  }

  .kdesk-btn-close:disabled { opacity: 0.6; cursor: default; }

  .kdesk-btn-open {
    border-color: ${Colors.navy};
    background: linear-gradient(165deg, ${Colors.navyLight}, ${Colors.navy});
    color: ${Colors.white};
    box-shadow: 0 2px 6px -2px rgba(11, 31, 51, 0.4);
  }

  .kdesk-btn-open:hover {
    border-color: #1c4670;
    background: linear-gradient(165deg, #1d4a70, ${Colors.navy});
    box-shadow: 0 8px 16px -8px rgba(11, 31, 51, 0.55);
  }

  /* A job that has waited a day is edged, because a queue that hides its oldest
     work is a queue that fails. */
  .kdesk-card-stale { border-color: ${Colors.amber}; }
  .kdesk-card-stale .kdesk-side { background: #fffcf5; }

  /* The hover must not outvote the warning: a plain "card:hover" rule is more
     specific than "card-stale" and would grey the edge out under the cursor on
     the very card an officer is leaning in to read. */
  .kdesk-card-stale:hover { border-color: ${Colors.amber}; }

  /* A closed incident is still auditable, so it is quieted rather than greyed
     out of existence. */
  .kdesk-card-closed .kdesk-shot img { filter: saturate(0.55); }
  .kdesk-card-closed .kdesk-shot-sev { opacity: 0.5; }
  .kdesk-card-closed .kdesk-title { color: ${Colors.muted}; }
  .kdesk-card-closed .kdesk-side { background: #fafbfd; }

  @media (max-width: 860px) {
    /* The rail folds to two by two. The divider that was taken off the leading
       column must be put back with the same weight it was removed with, or the
       hairlines vanish instead of moving: "nth-child(2n)" is written after
       "not(:first-child)" so the tie breaks the right way. */
    .kdesk-rail,
    .kdesk-skeleton { grid-template-columns: repeat(2, 1fr); }

    .kdesk-cell:not(:first-child),
    .kdesk-skeleton-cell:not(:first-child) { border-left: none; }
    .kdesk-cell:nth-child(2n),
    .kdesk-skeleton-cell:nth-child(2n) { border-left: 1px solid #eef1f5; }
    .kdesk-cell:nth-child(n+3),
    .kdesk-skeleton-cell:nth-child(n+3) { border-top: 1px solid #eef1f5; }
  }

  @media (max-width: 900px) {
    /* Below this the picture would be squeezed beside its own text, so it takes
       the full width of the card and the account of it starts underneath. */
    .kdesk-card { flex-direction: column; }
    .kdesk-open { flex-direction: column; gap: 0; }
    .kdesk-shot { flex: none; width: 100%; height: auto; aspect-ratio: 16 / 9; min-height: 0; align-self: stretch; }
    .kdesk-shot-sev { top: auto; left: 0; right: 0; bottom: 0; width: auto; height: 4px; }
    .kdesk-main { padding: 14px 16px 12px; }
    .kdesk-side {
      flex: none;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      border-left: none;
      border-top: 1px solid #eef1f5;
    }
    .kdesk-stage { margin-right: auto; }
    .kdesk-actions { flex-direction: row; margin-top: 0; }
  }

  @media (max-width: 640px) {
    .kdesk-hero { padding: 16px; }
    .kdesk-controls { flex-direction: column; align-items: stretch; }
    .kdesk-search { flex: none; width: 100%; }
    /* In column mode the chip row must fill the card and scroll inside itself,
       never keep the six-chip intrinsic width that spills past the panel. */
    .kdesk-filters { width: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .kdesk,
    .kdesk-card,
    .kdesk-shot img,
    .kdesk-shape-seg,
    .kdesk-filter {
      animation: none;
      transition: none;
    }

    .kdesk-live-on::after { animation: none; opacity: 0.4; }
    .kdesk-shot-out i { animation: none; }
    .kdesk-card:hover { transform: none; }

    .kdesk-skeleton-cell i,
    .kdesk-skeleton-cell em,
    .kdesk-skeleton-cell b {
      animation: none;
      background: #eef1f5;
    }
  }
`;
