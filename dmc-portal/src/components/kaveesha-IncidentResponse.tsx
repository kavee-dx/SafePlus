import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Camera,
  CheckCircle2,
  ClipboardList,
  Eye,
  Flag,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  Phone,
  Radio,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
  Unlock,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import {
  type DispatchRoll,
  type IncidentDetail,
  type TeamCandidate,
  acceptIncident,
  cancelMission,
  closeIncident,
  dispatchTeam,
  fetchIncident,
  openDispatchStream,
  reopenIncident,
} from "../services/kaveesha-dispatchApi";
import { DISPATCH_CSS, RESPONSE_CSS } from "../styles/kaveesha-dispatchStyles";
import {
  formatDateTime,
  formatDistance,
  formatEta,
  humanizeHazard,
  isLiveStage,
  relativeTime,
  scoreColor,
  severityColor,
  stageMeta,
} from "../utils/kaveesha-dispatchFormat";
import KaveeshaResponseMap, {
  type ResponseMapLine,
  type ResponseMapMarker,
} from "./kaveesha-ResponseMap";
import { MissionCard } from "./kaveesha-MissionBoard";

/* ------------------------------------------------------------------ *
 * The district officer's incident response page (UC-03).
 *
 * Reached by clicking one verified incident on the desk, so this screen holds
 * exactly one incident and answers one question: who do we send, and who is
 * already out there?
 *
 * The order down the page is the order of the work:
 *   1. the incident and where it is        — read it, accept it for the district
 *   2. the teams already sent              — live, straight under the map
 *   3. the teams still available           — the second string, for the moment
 *                                            the first one is slow or turns back
 *
 * Nothing here verifies a report. A DMC officer settled that upstairs, and it is
 * only because they did that this incident exists on this page.
 * ------------------------------------------------------------------ */

/** How often the page re-reads itself while a team is out there. */
const LIVE_POLL_MS = 20000;

/** A team that has not said anything for this long is a team to chase. */
const SILENCE_MINUTES = 20;

/** A tasking the leader has not even acknowledged for this long is stalling. */
const UNANSWERED_MINUTES = 10;

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
  LOW: 3,
};

/** Whole minutes between a timestamp and the moment this picture was read. */
function minutesBefore(stamp: number, value: string | null | undefined): number | null {
  if (!value) return null;

  const at = new Date(value).getTime();

  if (!Number.isFinite(at)) return null;

  return Math.max(0, Math.round((stamp - at) / 60000));
}

function breakdownRows(candidate: TeamCandidate): { label: string; value: number }[] {
  return [
    { label: "Reach", value: candidate.breakdown.reach },
    { label: "Capability", value: candidate.breakdown.capability },
    { label: "Workload", value: candidate.breakdown.workload },
    { label: "Readiness", value: candidate.breakdown.readiness },
  ];
}

const BAR_COLORS: Record<string, string> = {
  Reach: Colors.blue,
  Capability: Colors.success,
  Workload: Colors.amber,
  Readiness: Colors.navyLight,
};

/** Newest first, so the mission the officer is waiting on is always on top. */
function missionOrder(a: DispatchRoll, b: DispatchRoll): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export default function KaveeshaIncidentResponse({
  token,
  reportId,
  district,
  onBack,
}: {
  token: string;
  /** The incident the desk was clicked on. This page never shows another. */
  reportId: string;
  /** The signed-in officer's own district, used for the trail at the top. */
  district: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<IncidentDetail | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const [ago, setAgo] = useState(0);
  const [tick, setTick] = useState(0);
  const [poll, setPoll] = useState(0);
  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const [dialogFor, setDialogFor] = useState<TeamCandidate | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [handover, setHandover] = useState("");
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [showAllExcluded, setShowAllExcluded] = useState(false);
  /* The live feed: whether the district's stream is held open right now, and the
     last thing that moved on it. Shown so the officer can trust that what they
     are reading is the field as it is, not as it was twenty seconds ago. */
  const [streamUp, setStreamUp] = useState(false);
  const [liveFeed, setLiveFeed] = useState<string | null>(null);
  /* The closing ritual. A note is only forced when no team ever went, because
     the desk has to be able to explain later why nothing was sent. */
  const [closing, setClosing] = useState(false);
  const [closePanel, setClosePanel] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const sentRef = useRef<HTMLDivElement | null>(null);

  const loading = !ready;

  const missions = useMemo(
    () => (detail?.dispatches ?? []).slice().sort(missionOrder),
    [detail]
  );
  const liveMissions = useMemo(
    () => missions.filter((roll) => isLiveStage(roll.status)),
    [missions]
  );
  const hasLive = liveMissions.length > 0;

  /* Read the incident: its facts, its pictures, the ranking around its map point
     and every mission it has had. Re-read on a manual refresh, after an action,
     and on the live beat while a team is out there. */
  useEffect(() => {
    if (!token || !reportId) return;

    let cancelled = false;

    fetchIncident(token, reportId)
      .then((result) => {
        if (cancelled) return;

        setDetail(result);
        setLoadError(null);
        setStamp(Date.now());
      })
      .catch((cause: Error) => {
        if (cancelled) return;

        setDetail(null);
        setLoadError(cause.message || "This incident could not be read.");
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reportId, tick, poll]);

  // The live beat only runs while something is actually in the field.
  useEffect(() => {
    if (!hasLive) return;

    const beat = window.setInterval(() => setPoll((value) => value + 1), LIVE_POLL_MS);

    return () => window.clearInterval(beat);
  }, [hasLive]);

  /* The district's live feed. A leader tapping a stage on their phone, or another
     officer closing an incident, lands here in about a second — so this page
     re-reads itself the moment something moves instead of waiting for the poll.
     The 20 s poll above stays as the safety net for when the stream drops. */
  useEffect(() => {
    if (!token) return;

    const handle = openDispatchStream({
      token,
      onEvent: (event) => {
        if (event.kind === "hello") return;

        // Only re-read for something that touched *this* incident; the rest of
        // the district is the desk's business, not this page's.
        if (!event.reportId || event.reportId === reportId) {
          setLiveFeed(event.message ?? "Something on this incident moved.");
          setTick((value) => value + 1);
        }
      },
      // "connecting" fires on the effect's own synchronous path, so it is
      // ignored — the pill only ever flips from a settled state.
      onState: (state) => {
        if (state === "connecting") return;

        setStreamUp(state === "live");
      },
    });

    return () => handle.close();
  }, [token, reportId]);

  // "read 8 s ago" — counted in a timer, never from the render path.
  useEffect(() => {
    if (!stamp) return;

    const beat = window.setInterval(
      () => setAgo(Math.round((Date.now() - stamp) / 1000)),
      5000
    );

    return () => window.clearInterval(beat);
  }, [stamp]);

  // Escape closes the evidence viewer, the way a lightbox is expected to behave.
  useEffect(() => {
    if (!lightbox) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const reload = () => {
    setReady(false);
    setActionError(null);
    setTick((value) => value + 1);
  };

  const takeOn = async () => {
    const trimmed = handover.trim();

    if (trimmed.length > 0 && trimmed.length < 10) {
      setActionError(
        "Either leave the handover note empty or write at least 10 characters."
      );

      return;
    }

    setAccepting(true);
    setActionError(null);
    setNotice(null);

    try {
      const accepted = await acceptIncident(
        token,
        reportId,
        trimmed || undefined
      );

      setNotice(
        trimmed
          ? `The handover note on ${accepted.reportId} is saved.`
          : `${accepted.reportId} is on the ${accepted.locationDistrict} desk now${
              accepted.acceptedByName ? `, taken on by ${accepted.acceptedByName}` : ""
            }.`
      );
      setHandover("");
      setEditing(false);
      setTick((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The acceptance could not be recorded."
      );
    } finally {
      setAccepting(false);
    }
  };

  const openDispatch = (candidate: TeamCandidate) => {
    setPickedTeam(candidate.teamId);
    setDialogFor(candidate);
    setActionError(null);
    setNotice(null);
  };

  const confirmDispatch = async () => {
    if (!dialogFor) return;

    setSubmitting(true);
    setActionError(null);

    try {
      const roll = await dispatchTeam(token, reportId, {
        teamId: dialogFor.teamId,
        missionNotes: notes.trim() || undefined,
        recommendationScore: dialogFor.score,
        recommendationFactors: {
          distanceKm: dialogFor.distanceKm,
          etaMinutes: dialogFor.etaMinutes,
          breakdown: dialogFor.breakdown,
          affiliation: dialogFor.affiliation,
          outsideDistrict: dialogFor.outsideDistrict,
          reasons: dialogFor.reasons,
        },
      });

      setDialogFor(null);
      setNotes("");
      setPickedTeam(null);
      setNotice(
        `${roll.teamName} is tasked to ${roll.reportPublicId} as ${roll.dispatchCode}. The leader sees it on their board now.`
      );
      // One bump: the team just tasked leaves the ranking, and the sent block
      // under the map has to show the new mission straight away.
      setTick((value) => value + 1);
      sentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The team could not be tasked."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const standDown = async (roll: DispatchRoll, reason: string) => {
    setBusyId(roll.id);
    setActionError(null);

    try {
      const updated = await cancelMission(token, roll.id, reason);

      setNotice(
        `${updated.dispatchCode} is stood down and ${updated.teamName} is free again — you can task another team below.`
      );
      setTick((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The mission could not be stood down."
      );
    } finally {
      setBusyId(null);
    }
  };

  /* The district finishes with an incident. Refused while a team is still out, and
     the note is only demanded when nothing was ever sent — the same rules the
     server enforces, mirrored here so the officer is not met with a bare 400. */
  const finishIncident = async () => {
    const trimmed = closeNote.trim();

    if (missions.length === 0 && trimmed.length === 0) {
      setActionError(
        "No team was ever sent to this incident, so a closing note is required — say why it is being wrapped up without one."
      );

      return;
    }

    setClosing(true);
    setActionError(null);
    setNotice(null);

    try {
      const finished = await closeIncident(token, reportId, trimmed || undefined);

      setNotice(
        `${finished.reportId} is closed for ${finished.locationDistrict}. ${finished.totalRescued} rescued · ${finished.totalEvacuated} evacuated — kept on the desk as finished work.`
      );
      setClosePanel(false);
      setCloseNote("");
      setTick((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The incident could not be closed."
      );
    } finally {
      setClosing(false);
    }
  };

  /* Undo a closure. The acceptance and every mission stay exactly as they were;
     only the closing stamp comes off, so the incident is back on the live desk. */
  const openAgain = async () => {
    setClosing(true);
    setActionError(null);
    setNotice(null);

    try {
      const reopened = await reopenIncident(token, reportId);

      setNotice(
        `${reopened.reportId} is back on the ${reopened.locationDistrict} desk. A team can be tasked again.`
      );
      setTick((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "The incident could not be reopened."
      );
    } finally {
      setClosing(false);
    }
  };

  /* Held in a memo of its own: the map and the ranking both read this list, and a
     fresh array on every render would throw their work away each time. */
  const candidates = useMemo(() => detail?.candidates ?? [], [detail]);
  const photos = detail
    ? detail.evidence.filter((file) => file.fileKind === "PHOTO")
    : [];

  /* Also memoised: it is a dependency of the marker and line builders below, and
     an object literal rebuilt every render would re-draw the map on each of them. */
  const point = useMemo(() => {
    if (
      !(
        typeof detail?.locationLat === "number" &&
        typeof detail?.locationLng === "number" &&
        Number.isFinite(detail.locationLat) &&
        Number.isFinite(detail.locationLng)
      )
    ) {
      return null;
    }

    return { lat: detail.locationLat, lng: detail.locationLng };
  }, [detail]);

  /* One map for the whole decision: the incident, the teams that could still go,
     and the teams that have already gone out to it. */
  const markers = useMemo<ResponseMapMarker[]>(() => {
    if (!detail) return [];

    const list: ResponseMapMarker[] = [];

    if (point) {
      list.push({
        id: "incident",
        lat: point.lat,
        lng: point.lng,
        tone: "incident",
        title: `${humanizeHazard(detail.hazardType)} — ${detail.reportId}`,
        lines: [
          detail.landmark || "No landmark recorded",
          `${detail.severityLevel}${
            typeof detail.affectedPopulation === "number"
              ? ` · ${detail.affectedPopulation} people affected`
              : ""
          }`,
          `Verified ${relativeTime(detail.verifiedAt)}`,
        ],
      });
    }

    liveMissions.forEach((roll) => {
      if (
        typeof roll.baseLatitude !== "number" ||
        typeof roll.baseLongitude !== "number" ||
        !Number.isFinite(roll.baseLatitude) ||
        !Number.isFinite(roll.baseLongitude)
      ) {
        return;
      }

      list.push({
        id: `mission-${roll.id}`,
        lat: roll.baseLatitude,
        lng: roll.baseLongitude,
        tone: "mission",
        title: `${roll.teamName} — ${stageMeta(roll.status).label}`,
        lines: [
          roll.dispatchCode,
          `${roll.leaderFullName} · ${roll.memberCount} members`,
          `Last word ${relativeTime(
            roll.events[0]?.createdAt ?? roll.updatedAt
          )}`,
        ],
        selected: pickedTeam === roll.teamId,
        onSelect: () => setPickedTeam(roll.teamId),
      });
    });

    candidates.forEach((candidate, index) => {
      if (
        typeof candidate.baseLatitude !== "number" ||
        typeof candidate.baseLongitude !== "number" ||
        !Number.isFinite(candidate.baseLatitude) ||
        !Number.isFinite(candidate.baseLongitude)
      ) {
        return;
      }

      const chosen = pickedTeam === candidate.teamId;

      list.push({
        id: candidate.teamId,
        lat: candidate.baseLatitude,
        lng: candidate.baseLongitude,
        badge: String(index + 1),
        tone: index === 0 || chosen ? "lead" : "team",
        title: `${index + 1}. ${candidate.teamName}`,
        lines: [
          `${candidate.teamType ?? "Rescue team"} · ${candidate.district} District`,
          `${formatDistance(candidate.distanceKm)} away · about ${formatEta(candidate.etaMinutes)}`,
          `Fit score ${candidate.score} · leader ${candidate.leaderFullName}`,
        ],
        selected: chosen || index === 0,
        onSelect: (id) => setPickedTeam(id === pickedTeam ? null : id),
      });
    });

    return list;
  }, [candidates, detail, liveMissions, pickedTeam, point]);

  const lines = useMemo<ResponseMapLine[]>(() => {
    if (!point) return [];

    const target: [number, number] = [point.lat, point.lng];
    const drawn: ResponseMapLine[] = [];

    // A team already on the way is the line that matters, so it is drawn solid.
    liveMissions.forEach((roll) => {
      if (
        typeof roll.baseLatitude !== "number" ||
        typeof roll.baseLongitude !== "number"
      ) {
        return;
      }

      drawn.push({
        from: [roll.baseLatitude, roll.baseLongitude],
        to: target,
        label: stageMeta(roll.status).label,
        primary: true,
      });
    });

    candidates
      .filter(
        (candidate) =>
          typeof candidate.baseLatitude === "number" &&
          typeof candidate.baseLongitude === "number" &&
          Number.isFinite(candidate.baseLatitude) &&
          Number.isFinite(candidate.baseLongitude)
      )
      .slice(0, 5)
      .forEach((candidate, index) => {
        drawn.push({
          from: [candidate.baseLatitude as number, candidate.baseLongitude as number],
          to: target,
          label: formatDistance(candidate.distanceKm),
          primary: index === 0 && drawn.length === 0,
        });
      });

    return drawn;
  }, [candidates, liveMissions, point]);

  /* The two things an officer actually wants shouted at them: a team that has
     gone quiet, and a team that has come back. Both mean the same action — send
     the next one from the list below. */
  const watchlines = liveMissions.map((roll) => {
    const lastWord = roll.events[0]?.createdAt ?? roll.updatedAt;
    const quiet = minutesBefore(stamp, lastWord) ?? 0;
    const unanswering =
      roll.status === "DISPATCHED" &&
      (minutesBefore(stamp, roll.createdAt) ?? 0) >= UNANSWERED_MINUTES;

    return {
      roll,
      quiet,
      silent: quiet >= SILENCE_MINUTES,
      unanswering,
    };
  });

  const turnedBack = missions.find(
    (roll) => roll.status === "DECLINED" || roll.status === "CANCELLED"
  );

  const sortedByDanger = SEVERITY_RANK[(detail?.severityLevel ?? "").toUpperCase()] ?? 4;
  const urgent = Boolean(detail?.immediateDanger) || sortedByDanger <= 1;

  /* The three closure facts the page needs. An incident is closed once the
     district has stamped it; it can be closed once it has been taken on and no
     team is left out in the field. */
  const closed = Boolean(detail?.resolvedAt);
  const accepted = Boolean(detail?.acceptedAt);
  const canClose = accepted && !hasLive && !closed;

  return (
    <div className="kyp-page">
      <div className="kyp-bar">
        <button type="button" className="kyp-back" onClick={onBack}>
          <ArrowLeft size={14} />
          Incident desk
        </button>

        <span className="kyp-bar-code">{reportId}</span>
        <span className="kyp-bar-place">
          <MapPin size={12} />
          {detail?.locationDistrict ?? district} District
        </span>

        {closed && (
          <span className="kyp-bar-closed">
            <Lock size={11} />
            Closed
          </span>
        )}

        <span className="kyp-bar-right">
          <span
            className={`kyp-stream ${streamUp ? "kyp-stream-on" : ""}`}
            title={
              streamUp
                ? "Connected to the district's live feed. A stage the leader taps on their phone appears here at once."
                : "The live feed is reconnecting. The page still re-reads on the 20s beat while a team is out."
            }
          >
            <Radio size={11} />
            {streamUp ? "Live feed" : "Reconnecting"}
          </span>
          <span className={`kyp-live ${hasLive ? "kyp-live-on" : ""}`}>
            <Navigation size={12} />
            {hasLive
              ? `${liveMissions.length} out — read ${ago < 5 ? "just now" : `${ago}s ago`}`
              : closed
                ? "Finished"
                : "No mission running"}
          </span>
          <button
            type="button"
            className="kdx-btn kdx-btn-sm"
            onClick={reload}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={13} className="kdx-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Refresh
          </button>
        </span>
      </div>

      {/* What just moved, said out loud. A page that updates silently makes an
          officer doubt it; one line of proof is worth more than a spinner. */}
      {liveFeed && (
        <div className="kyp-flash">
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

      {loading && !detail ? (
        <div className="kdx-panel">
          <div className="kdx-loading">
            <Loader2 size={16} className="kdx-spin" />
            Opening the incident, its pictures and the teams around it…
          </div>
        </div>
      ) : !detail ? (
        <div className="kdx-panel">
          <div className="kdx-empty">
            <TriangleAlert size={26} />
            <span>{loadError ?? "This incident could not be read."}</span>
            <button type="button" className="kdx-btn" onClick={reload}>
              <RefreshCw size={13} />
              Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ------------------------- 1. the incident ------------------------- */}
          <section className="kyp-hero">
            <span
              className="kyp-hero-rail"
              style={{ background: severityColor(detail.severityLevel) }}
            />

            <div className="kyp-hero-main">
              <div className="kyp-hero-top">
                <div className="kyp-hero-title">
                  {humanizeHazard(detail.hazardType)}
                  <span
                    className="kyp-hero-sev"
                    style={{
                      background: `${severityColor(detail.severityLevel)}1A`,
                      color: severityColor(detail.severityLevel),
                    }}
                  >
                    {detail.severityLevel}
                  </span>
                  {detail.immediateDanger && (
                    <span className="kyp-hero-danger">
                      <TriangleAlert size={11} />
                      Danger to life
                    </span>
                  )}
                </div>

                <div className="kyp-hero-sub">
                  {detail.reportId} · {detail.locationDistrict} District · verified{" "}
                  {formatDateTime(detail.verifiedAt)}
                  {detail.verifiedByName ? ` by ${detail.verifiedByName}` : ""}
                </div>
              </div>

              <div className="kyp-flow">
                <FlowStrip detail={detail} />
              </div>

              <p className="kdx-desc">{detail.description}</p>

              <div className="kdx-facts">
                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <MapPin size={12} />
                    Where
                  </div>
                  <div className="kdx-fact-text">
                    {detail.landmark || "No landmark given"}
                    {point ? (
                      <span className="kdx-muted-line">
                        {" "}
                        · {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                      </span>
                    ) : (
                      <span className="kdx-muted-line"> · no map point saved</span>
                    )}
                  </div>
                </div>

                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <Users size={12} />
                    Who is affected
                  </div>
                  <div className="kdx-fact-value">
                    {typeof detail.affectedPopulation === "number"
                      ? `${detail.affectedPopulation} people`
                      : "Not stated"}
                  </div>
                </div>

                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <Timer size={12} />
                    Observed
                  </div>
                  <div className="kdx-fact-value">{relativeTime(detail.observedAt)}</div>
                </div>

                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <Eye size={12} />
                    Evidence
                  </div>
                  <div className="kdx-fact-value">
                    {detail.evidence.length === 0
                      ? "No files"
                      : `${detail.evidence.length} file${
                          detail.evidence.length === 1 ? "" : "s"
                        }`}
                  </div>
                </div>
              </div>

              {detail.reporterPhone && (
                <div className="kyp-hero-call">
                  <span className="kyp-hero-call-label">Reporter</span>
                  {detail.reporterName && (
                    <span className="kyp-hero-call-name">{detail.reporterName}</span>
                  )}
                  <a className="kdx-chip kdx-chip-info" href={`tel:${detail.reporterPhone}`}>
                    <Phone size={11} />
                    {detail.reporterPhone}
                  </a>
                </div>
              )}

              {photos.length > 0 && (
                <div className="kdx-gallery kyp-hero-strip">
                  {photos.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      title="Open full size"
                      onClick={() =>
                        setLightbox({
                          url: file.fileUrl,
                          label: `${detail.reportId} · ${file.fileKind}`,
                        })
                      }
                    >
                      <img src={file.fileUrl} alt={`Evidence for ${detail.reportId}`} />
                      <span className="kyp-hero-strip-count">
                        <Camera size={10} />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {detail.acceptedAt ? (
                <>
                  <div className="kyp-accepted">
                    <CheckCircle2 size={15} />
                    <span>
                      Taken on by the district
                      {detail.acceptedByName ? ` — ${detail.acceptedByName}` : ""} ·{" "}
                      {relativeTime(detail.acceptedAt)}
                      {detail.handoverNote ? (
                        <em className="kyp-accepted-note">“{detail.handoverNote}”</em>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-sm"
                      onClick={() => {
                        setHandover(detail.handoverNote ?? "");
                        setEditing((open) => !open);
                      }}
                    >
                      {editing ? "Cancel" : "Correct the note"}
                    </button>
                  </div>

                  {editing && (
                    <div className="kyp-accept">
                      <div className="kyp-accept-lead">
                        <ShieldCheck size={16} />
                        <span>
                          <strong>Handover note.</strong> What the next shift needs to
                          know. Correcting it never touches the DMC's verification.
                        </span>
                      </div>

                      <div className="kyp-accept-row">
                        <input
                          className="kdx-input"
                          placeholder="e.g. The Divisional Secretariat is providing two boats."
                          value={handover}
                          maxLength={300}
                          onChange={(event) => setHandover(event.target.value)}
                        />
                        <button
                          type="button"
                          className="kdx-btn kdx-btn-task"
                          disabled={accepting}
                          onClick={() => void takeOn()}
                        >
                          {accepting ? (
                            <Loader2 size={14} className="kdx-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Save the note
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="kyp-accept">
                  <div className="kyp-accept-lead">
                    <ShieldCheck size={16} />
                    <span>
                      <strong>The district has not taken this on yet.</strong>{" "}
                      Accepting says {detail.locationDistrict} is working it — it is
                      not a verification, that was the DMC officer's call.
                    </span>
                  </div>

                  <div className="kyp-accept-row">
                    <input
                      className="kdx-input"
                      placeholder="Handover note for the next shift (optional)"
                      value={handover}
                      maxLength={300}
                      onChange={(event) => setHandover(event.target.value)}
                    />
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-task"
                      disabled={accepting}
                      onClick={() => void takeOn()}
                    >
                      {accepting ? (
                        <Loader2 size={14} className="kdx-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      Accept into the district
                    </button>
                  </div>
                </div>
              )}

              {/* A closed incident still tells its whole story — who wrapped it
                  up, when, and what the teams brought back — and offers the one
                  undo an officer ever needs: put it back on the live desk. */}
              {closed && (
                <div className="kyp-closed">
                  <div className="kyp-closed-lead">
                    <CheckCircle2 size={16} />
                    <span>
                      <strong>Closed.</strong>{" "}
                      {detail.resolvedByName
                        ? `${detail.resolvedByName} wrapped this up `
                        : "The district wrapped this up "}
                      {relativeTime(detail.resolvedAt)}
                      {detail.totalRescued > 0 || detail.totalEvacuated > 0
                        ? ` — ${detail.totalRescued} rescued · ${detail.totalEvacuated} evacuated.`
                        : "."}
                      {detail.resolutionNote ? (
                        <em className="kyp-closed-note">“{detail.resolutionNote}”</em>
                      ) : null}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="kdx-btn kdx-btn-sm"
                    onClick={() => void openAgain()}
                    disabled={closing}
                  >
                    {closing ? (
                      <Loader2 size={13} className="kdx-spin" />
                    ) : (
                      <Unlock size={13} />
                    )}
                    Reopen the incident
                  </button>
                </div>
              )}

              {/* The closing line is only offered once every team is back. A
                  mission still running means there is nothing to close yet. */}
              {canClose && (
                <div className="kyp-close">
                  <div className="kyp-close-lead">
                    <Flag size={16} />
                    <span>
                      <strong>Every team is back.</strong> Nothing is out in the field
                      on {detail.reportId} any more.
                      {missions.length === 0
                        ? " No team was ever sent here, so a closing note is required before you wrap it up."
                        : ` ${detail.totalRescued} rescued · ${detail.totalEvacuated} evacuated across ${missions.length} mission${
                            missions.length === 1 ? "" : "s"
                          }.`}
                    </span>
                  </div>

                  {closePanel ? (
                    <div className="kyp-close-row">
                      <input
                        className="kdx-input"
                        placeholder={
                          missions.length === 0
                            ? "Why is this being closed with no team sent? (required)"
                            : "Closing note for the record (optional)"
                        }
                        value={closeNote}
                        maxLength={400}
                        onChange={(event) => setCloseNote(event.target.value)}
                      />
                      <button
                        type="button"
                        className="kdx-btn kdx-btn-close"
                        disabled={closing}
                        onClick={() => void finishIncident()}
                      >
                        {closing ? (
                          <Loader2 size={14} className="kdx-spin" />
                        ) : (
                          <Lock size={14} />
                        )}
                        Confirm closure
                      </button>
                      <button
                        type="button"
                        className="kdx-btn kdx-btn-sm"
                        onClick={() => {
                          setClosePanel(false);
                          setCloseNote("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-close"
                      onClick={() => setClosePanel(true)}
                    >
                      <Lock size={14} />
                      Close the incident
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {!point && (
            <div className="kdx-danger">
              <MapPin size={15} />
              <span>
                This incident has no map point, so no team can be tasked to it and no
                travel time can be worked out. Call the reporter for the location and
                have the point saved on the report.
              </span>
            </div>
          )}

          {notice && (
            <div className="kdx-success">
              <CheckCircle2 size={15} />
              <span>{notice}</span>
              <button type="button" className="kdx-x" onClick={() => setNotice(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {actionError && (
            <div className="kdx-error">
              <TriangleAlert size={16} />
              <span>{actionError}</span>
            </div>
          )}

          {/* ------------------------- 2. the map ------------------------- */}
          <div className="kyp-map">
            <KaveeshaResponseMap
              markers={markers}
              lines={lines}
              boundaryDistrict={detail.locationDistrict}
              height={430}
              caption={
                urgent
                  ? "The scene, the teams out there, and who is nearest"
                  : "Where it happened and who can reach it"
              }
            />
          </div>

          {/* --------- 3. sent teams — live, right under the map --------- */}
          <div ref={sentRef} className="kyp-section">
            <div className="kyp-section-head">
              <span className="kyp-section-title">
                <Route size={15} />
                Sent to the field
              </span>
              <span className="kyp-section-sub">
                {liveMissions.length > 0
                  ? `${liveMissions.length} live · ${
                      streamUp ? "streaming as the leader updates" : `re-read every ${LIVE_POLL_MS / 1000}s`
                    }`
                  : missions.length > 0
                    ? `${missions.length} mission${missions.length === 1 ? "" : "s"} closed`
                    : "nothing sent yet"}
              </span>
            </div>

            {liveMissions.length === 0 && missions.length === 0 ? (
              <div className="kyp-quiet">
                <ClipboardList size={17} />
                <span>
                  No team has been tasked to this incident yet. The best fit is listed
                  below — task them and the mission will appear here as the leader works
                  through it.
                </span>
              </div>
            ) : (
              <div className="kdx-stack">
                {watchlines
                  .filter((line) => line.silent || line.unanswering)
                  .map(({ roll, quiet, unanswering }) => (
                    <div className="kdx-warn" key={`watch-${roll.id}`}>
                      <Timer size={15} />
                      <span>
                        <strong>{roll.teamName}</strong> is{" "}
                        {stageMeta(roll.status).label.toLowerCase()} and{" "}
                        {unanswering
                          ? `has not answered the tasking yet (${relativeTime(roll.createdAt)} ago) · ring ${roll.leaderPhone}`
                          : `has not reported in for ${quiet} minutes · ring ${roll.leaderPhone}`}
                        . You can task another team below and stand this one down.
                      </span>
                    </div>
                  ))}

                {turnedBack && (
                  <div className="kdx-danger">
                    <Ban size={15} />
                    <span>
                      <strong>{turnedBack.teamName}</strong> came back at{" "}
                      {stageMeta(turnedBack.status).label.toLowerCase()}
                      {turnedBack.declineReason || turnedBack.cancelReason
                        ? ` — ${turnedBack.declineReason || turnedBack.cancelReason}`
                        : ""}
                      . The next best team is waiting in the list below.
                    </span>
                  </div>
                )}

                {missions.map((roll) => (
                  <MissionCard
                    key={roll.id}
                    roll={roll}
                    showIncident={false}
                    busy={busyId === roll.id}
                    onStandDown={isLiveStage(roll.status) ? standDown : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* --------- 4. the teams still available to send --------- */}
          <div className="kyp-section">
            <div className="kyp-section-head">
              <span className="kyp-section-title">
                <Sparkles size={15} />
                Teams you can still send
              </span>
              <span className="kyp-section-sub">
                {candidates.length === 0
                  ? "none free right now"
                  : `${candidates.length} ranked by reach, capability, workload, readiness`}
              </span>
            </div>

            <p className="kyp-section-hint">
              A team that is tasked drops out of this list until its mission closes, and a
              second team can be sent to the same incident whenever the first one slows
              down.
            </p>

            {candidates.length === 0 ? (
              <div className="kdx-warn">
                <Ban size={15} />
                <span>
                  Every verified team in reach is unavailable or already on a mission.
                  Stand a mission down above to free a team, or wait for the live beat to
                  bring one back.
                </span>
              </div>
            ) : (
              <div className="kdx-teams">
                {candidates.map((candidate, index) => (
                  <TeamRow
                    key={candidate.teamId}
                    candidate={candidate}
                    rank={index + 1}
                    picked={pickedTeam === candidate.teamId}
                    busy={submitting}
                    onPick={() =>
                      setPickedTeam(
                        pickedTeam === candidate.teamId ? null : candidate.teamId
                      )
                    }
                    onTask={() => openDispatch(candidate)}
                  />
                ))}
              </div>
            )}

            {detail.excluded.length > 0 && (
              <details className="kyp-excluded">
                <summary className="kyp-excluded-summary">
                  {detail.excluded.length} team
                  {detail.excluded.length === 1 ? " is" : "s are"} held back — why
                </summary>

                <div className="kdx-chip-row" style={{ marginTop: 10 }}>
                  {(showAllExcluded ? detail.excluded : detail.excluded.slice(0, 24)).map(
                    (team) => (
                      <span key={team.teamId} className="kdx-chip" title={team.reason}>
                        <Ban size={10} />
                        {team.teamName} — {team.reason}
                      </span>
                    )
                  )}

                  {detail.excluded.length > 24 && (
                    <button
                      type="button"
                      className="kdx-btn kdx-btn-sm"
                      onClick={() => setShowAllExcluded((open) => !open)}
                    >
                      {showAllExcluded
                        ? "Show fewer"
                        : `Show the other ${detail.excluded.length - 24}`}
                    </button>
                  )}
                </div>
              </details>
            )}
          </div>
        </>
      )}

      {/* ------------------------- the tasking dialog ------------------------- */}
      {dialogFor && (
        <div className="kdx-modal-back" role="dialog" aria-modal="true">
          <div className="kdx-modal">
            <div className="kdx-modal-head">
              <div>
                <div className="kdx-modal-title">
                  Task {dialogFor.teamName} to {detail?.reportId ?? reportId}
                </div>
                <div className="kdx-modal-sub">
                  {humanizeHazard(detail?.hazardType ?? "")} ·{" "}
                  {detail?.severityLevel} · {formatDistance(dialogFor.distanceKm)} away ·
                  about {formatEta(dialogFor.etaMinutes)}
                </div>
              </div>
              <button
                type="button"
                className="kdx-x"
                onClick={() => setDialogFor(null)}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="kdx-modal-body">
              <div className="kdx-explain">
                <Sparkles size={15} />
                <span>
                  Fit score <strong>{dialogFor.score}</strong> — reach{" "}
                  {dialogFor.breakdown.reach}, capability {dialogFor.breakdown.capability},
                  workload {dialogFor.breakdown.workload}, readiness{" "}
                  {dialogFor.breakdown.readiness}. {dialogFor.reasons[0] ?? ""}
                </span>
              </div>

              {dialogFor.outsideDistrict && (
                <div className="kdx-warn">
                  <Route size={15} />
                  <span>
                    {dialogFor.teamName} works {dialogFor.district} District, not{" "}
                    {detail?.locationDistrict}. This is mutual aid — agree it with the
                    team leader before you send them.
                  </span>
                </div>
              )}

              {(detail?.liveDispatchCount ?? 0) > 0 && (
                <div className="kdx-warn">
                  <Navigation size={15} />
                  <span>
                    This incident already has {detail?.liveDispatchCount} mission
                    {detail?.liveDispatchCount === 1 ? "" : "s"} running.
                    Sending a second team is normal when the first is slow or the scene
                    needs a different capability — say in the brief what this team is for,
                    so the two leaders do not duplicate each other.
                  </span>
                </div>
              )}

              <div className="kdx-facts">
                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <Users size={12} />
                    Leader
                  </div>
                  <div className="kdx-fact-text">
                    {dialogFor.leaderFullName}
                    <a
                      className="kdx-chip kdx-chip-info"
                      href={`tel:${dialogFor.leaderPhone}`}
                      style={{ textDecoration: "none", marginLeft: 6 }}
                    >
                      <Phone size={10} />
                      {dialogFor.leaderPhone}
                    </a>
                  </div>
                </div>
                <div className="kdx-fact">
                  <div className="kdx-fact-label">
                    <MapPin size={12} />
                    Staging point
                  </div>
                  <div className="kdx-fact-text">
                    {dialogFor.baseLocationLabel || "No label saved"}
                  </div>
                </div>
              </div>

              <div className="kdx-form">
                <label className="kdx-label" htmlFor="mission-notes">
                  Mission brief for the team
                </label>
                <textarea
                  id="mission-notes"
                  className="kdx-area"
                  value={notes}
                  maxLength={500}
                  placeholder="What they will find, what to bring, and who to contact on arrival."
                  onChange={(event) => setNotes(event.target.value)}
                />
                <span className="kdx-hint">
                  {notes.length}/500 · the leader reads this on their assignment board, so
                  keep it plain and short.
                </span>
              </div>

              <p className="kdx-hint">
                Tasking marks the team <strong>on deployment</strong> and holds it out of
                every other recommendation until the leader closes the mission or you
                stand it down.
              </p>
            </div>

            <div className="kdx-modal-foot">
              <button type="button" className="kdx-btn" onClick={() => setDialogFor(null)}>
                Not this team
              </button>
              <button
                type="button"
                className="kdx-btn kdx-btn-task"
                disabled={submitting}
                onClick={confirmDispatch}
              >
                {submitting ? (
                  <Loader2 size={14} className="kdx-spin" />
                ) : (
                  <Send size={14} />
                )}
                Confirm dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="kdx-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.label} />
          <div className="kdx-lightbox-bar" onClick={(event) => event.stopPropagation()}>
            <span className="kdx-lightbox-label">{lightbox.label}</span>
            <button
              type="button"
              className="kdx-lightbox-close"
              onClick={() => setLightbox(null)}
            >
              <X size={14} />
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`${DISPATCH_CSS}${RESPONSE_CSS}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Where this incident stands, in five honest steps. "Verified" is always behind
 * the officer — nothing the DMC has not verified reaches this page.
 * ------------------------------------------------------------------ */
const FLOW: { key: string; label: string; icon: typeof Send }[] = [
  { key: "verified", label: "Verified by the DMC", icon: CheckCircle2 },
  { key: "accepted", label: "Taken on by the district", icon: ShieldCheck },
  { key: "sent", label: "A team is tasked", icon: Send },
  { key: "working", label: "In the field", icon: Navigation },
  { key: "closed", label: "Mission closed", icon: Flag },
];

function flowIndexOf(detail: IncidentDetail): number {
  if (!detail.acceptedAt) return 1;
  if (detail.liveDispatchCount > 0) return 3;
  if (detail.dispatchCount > 0) return 4;

  return 2;
}

function FlowStrip({ detail }: { detail: IncidentDetail }) {
  const current = flowIndexOf(detail);

  return (
    <div className="kdx-stage-strip kdx-scroll-x">
      {FLOW.map((step, index) => {
        const StepIcon = step.icon;

        return (
          <span
            key={step.key}
            className={`kdx-step ${index < current ? "kdx-step-done" : ""} ${
              index === current ? "kdx-step-now" : ""
            }`}
          >
            <StepIcon size={12} />
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One ranked team, and the reason it is ranked where it is.
 * ------------------------------------------------------------------ */
function TeamRow({
  candidate,
  rank,
  picked,
  busy,
  onPick,
  onTask,
}: {
  candidate: TeamCandidate;
  rank: number;
  picked: boolean;
  busy: boolean;
  onPick: () => void;
  onTask: () => void;
}) {
  const color = scoreColor(candidate.score);

  return (
    <article
      className={`kdx-team ${rank === 1 ? "kdx-team-pick" : ""} ${
        picked ? "kdx-team-map" : ""
      }`}
    >
      <button
        type="button"
        className={`kdx-rank ${rank === 1 ? "kdx-rank-lead" : ""}`}
        onClick={onPick}
        title="Show this team on the map"
      >
        {rank}
      </button>

      <div style={{ minWidth: 0 }}>
        <div className="kdx-team-name">
          {candidate.teamName}
          <span className="kdx-team-type">{candidate.teamType ?? "Rescue team"}</span>
          {candidate.outsideDistrict && (
            <span className="kdx-chip kdx-chip-warn">
              mutual aid · {candidate.district}
            </span>
          )}
          {rank === 1 && <span className="kdx-chip kdx-chip-good">best fit</span>}
        </div>

        <div className="kdx-team-line">
          {formatDistance(candidate.distanceKm)} · about {formatEta(candidate.etaMinutes)} ·{" "}
          {candidate.memberCount} members · {candidate.leaderFullName}{" "}
          {candidate.leaderPhone ? `(${candidate.leaderPhone})` : ""}
        </div>

        {candidate.baseLocationLabel && (
          <div className="kdx-team-line">
            <MapPin size={11} /> stages from {candidate.baseLocationLabel}
          </div>
        )}

        {candidate.reasons.length > 0 && (
          <div className="kdx-reasons">
            {candidate.reasons.map((reason) => (
              <span key={reason} className="kdx-chip">
                {reason}
              </span>
            ))}
          </div>
        )}

        <div className="kdx-bars">
          {breakdownRows(candidate).map((row) => (
            <div key={row.label} className="kdx-bar">
              <div className="kdx-bar-top">
                <span>{row.label}</span>
                <span>{Math.round(row.value)}</span>
              </div>
              <div className="kdx-bar-track">
                <div
                  className="kdx-bar-fill"
                  style={{
                    width: `${Math.max(2, Math.min(100, row.value))}%`,
                    background: BAR_COLORS[row.label],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="kdx-score">
        <div>
          <div className="kdx-score-num" style={{ color }}>
            {candidate.score}
          </div>
          <div className="kdx-score-cap">fit score</div>
        </div>

        <button
          type="button"
          className="kdx-btn kdx-btn-task kdx-btn-sm"
          disabled={busy}
          onClick={onTask}
        >
          <Send size={13} />
          Task team
        </button>
      </div>
    </article>
  );
}
