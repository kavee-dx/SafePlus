import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Home,
  Inbox,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AuthUser } from "../types/auth";
import { getStoredDmcToken } from "../services/dmc-authApi";
import {
  fetchPortalProfile,
  type PortalProfile,
} from "../services/dildhara-portalAuthApi";
import {
  fetchDistrictRescueBoard,
  type DistrictRescueBoard,
} from "../services/kaveesha-districtTeamsApi";
import { fetchIncidents, type IncidentSummary } from "../services/kaveesha-dispatchApi";
import KaveeshaDistrictRescueBoard from "../components/kaveesha-DistrictRescueBoard";
import KaveeshaIncidentDesk from "../components/kaveesha-IncidentDesk";
import KaveeshaIncidentResponse from "../components/kaveesha-IncidentResponse";
import KaveeshaShelterArea from "../components/kaveesha-ShelterArea";
import KaveeshaOfficerNotificationCenter from "../components/kaveesha-OfficerNotificationCenter";
import {
  CapacityDonutChart,
  DisasterCoverageChart,
  type CoverageRow,
  type DonutSegment,
} from "../components/kaveesha-charts";
import {
  DISASTER_KINDS,
  FORCE_COVER,
  teamsForDisaster,
} from "../constants/kaveesha-disasterKinds";

interface DistrictOfficerDashboardProps {
  officer: AuthUser;
  onLogout: () => void;
}

/**
 * "response" is not a place in the sidebar — it is the page one incident opens
 * into from the desk, so it is navigated to rather than navigated by.
 */
type DashboardView = "overview" | "teams" | "desk" | "response" | "shelter" | "profile";

interface OfficerIdentity {
  fullName: string;
  email: string;
  officerId: string;
  district: string;
  clearanceLevel: string;
  dutyPhone: string;
  secretariats: string[];
}

const VIEW_META: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: "District overview",
    subtitle: "Live hazard picture for your assigned district",
  },
  teams: {
    title: "Rescue force",
    subtitle:
      "Verified rescue teams and the organizations behind them, ready for tasking",
  },
  desk: {
    title: "Incident desk",
    subtitle:
      "Only incidents the DMC has verified reach here — take them on for your district and open one to send a team",
  },
  response: {
    title: "Incident response",
    subtitle:
      "One verified incident, its map point, the teams you have sent and the ones you can still send",
  },
  shelter: {
    title: "Shelter coordination",
    subtitle:
      "Register shelters and their capacity, allocate waiting groups to the nearest rooms, and create the managers who confirm arrivals",
  },
  profile: {
    title: "My profile",
    subtitle: "Your assignment, clearance and contact details",
  },
};

function readString(
  source: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function buildIdentity(
  officer: AuthUser,
  profile: PortalProfile | null
): OfficerIdentity {
  const fallback = officer as unknown as Record<string, unknown>;
  const user = profile?.user ?? fallback;
  const details = profile?.details;

  const rawSecretariats =
    readString(details, "divisionalSecretariats") ||
    readString(user, "divisionalSecretariats");

  return {
    fullName:
      readString(user, "fullName") ||
      readString(fallback, "fullName") ||
      "District Officer",
    email: readString(user, "email") || readString(fallback, "email"),
    officerId: readString(details, "officerId"),
    district:
      readString(user, "district") ||
      readString(details, "assignedDistrict") ||
      readString(fallback, "district"),
    clearanceLevel:
      readString(details, "clearanceLevel") ||
      readString(user, "clearanceLevel"),
    dutyPhone:
      readString(details, "dutyPhoneNumber") ||
      readString(user, "dutyPhoneNumber"),
    secretariats: rawSecretariats
      ? rawSecretariats
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  };
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ *
 * The disasters a district can be asked to cover, and the three colours that
 * say where a team is, both live in kaveesha-disasterKinds so the overview's
 * cover chart and the rescue force board cannot drift apart.
 * ------------------------------------------------------------------ */

export default function KaveeshaDistrictOfficerDashboard({
  officer,
  onLogout,
}: DistrictOfficerDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 1024
  );
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * The incident the desk was clicked on. It is held here rather than inside a
   * component so Back can drop straight to the desk and the sidebar can keep the
   * desk highlighted while the officer works the incident.
   */
  const [responseReport, setResponseReport] = useState<string | null>(null);

  const token = getStoredDmcToken();

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchPortalProfile(token)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch(() => {
        if (!cancelled) setProfileError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const identity = useMemo(
    () => buildIdentity(officer, profile),
    [officer, profile]
  );

  /**
   * Moving between views always refetches. An incident is only carried into the
   * response page when the desk explicitly hands one over; every other route
   * clears it, so the response page never reopens the last pick by accident.
   */
  const go = (view: DashboardView, handover?: { incident?: string }) => {
    setCurrentView(view);
    setNotice(null);
    setResponseReport(view === "response" ? (handover?.incident ?? null) : null);
    setRefreshKey((key) => key + 1);
  };

  const nav: { view: DashboardView; label: string; icon: typeof Home }[] = [
    { view: "overview", label: "Overview", icon: Home },
    { view: "teams", label: "Rescue force", icon: Users },
    { view: "desk", label: "Incident desk", icon: Inbox },
    { view: "shelter", label: "Shelters", icon: Building2 },
    { view: "profile", label: "My profile", icon: User },
  ];

  // While an incident is open, the desk stays lit: that is where Back returns.
  const activeView: DashboardView = currentView === "response" ? "desk" : currentView;

  return (
    <div className="kdash-app">
      <aside
        className={`kdash-sidebar ${
          sidebarOpen ? "kdash-sidebar-open" : "kdash-sidebar-closed"
        }`}
      >
        <div className="kdash-sidebar-head">
          <div className="kdash-brand">
            <div className="kdash-brand-mark">
              <ShieldCheck size={22} />
            </div>
            <div className="kdash-brand-text">
              <div className="kdash-brand-name">
                Safe<span>Plus</span>
              </div>
              <div className="kdash-brand-sub">District Operations</div>
            </div>
          </div>
          <button
            type="button"
            className="kdash-icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronDown size={16} /> : <MapPin size={16} />}
          </button>
        </div>

        {identity.district && (
          <div className="kdash-district-chip">
            <MapPin size={13} />
            <span>{identity.district} District</span>
          </div>
        )}

        <nav className="kdash-nav">
          {nav.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`kdash-nav-item ${
                activeView === item.view ? "kdash-nav-item-active" : ""
              }`}
              onClick={() => go(item.view)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="kdash-sidebar-foot">
          <div className="kdash-officer">
            <div className="kdash-avatar">
              {identity.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="kdash-officer-meta">
              <div className="kdash-officer-name">{identity.fullName}</div>
              <div className="kdash-officer-role">District Officer</div>
            </div>
          </div>
          <button type="button" className="kdash-logout" onClick={onLogout}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="kdash-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        className="kdash-fab-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <main className="kdash-main">
        <header className="kdash-topbar">
          <div className="kdash-topbar-titles">
            <div className="kdash-topbar-eyebrow">
              <span className="kdash-eyebrow-dot" />
              SafePlus · District Operations
            </div>
            <h1>{VIEW_META[currentView].title}</h1>
            <p>{VIEW_META[currentView].subtitle}</p>
          </div>

          <div className="kdash-topbar-side">
            <KaveeshaOfficerNotificationCenter
              onOpenIncident={(reportId) => go("response", { incident: reportId })}
            />
            {identity.district && (
              <span className="kdash-topbar-district">
                <MapPin size={13} />
                {identity.district} District
              </span>
            )}
            <button
              type="button"
              className={`kdash-topbar-user ${
                currentView === "profile" ? "kdash-topbar-user-active" : ""
              }`}
              onClick={() => go("profile")}
              aria-label="My profile"
              title="My profile"
            >
              <span className="kdash-topbar-avatar">
                {identity.fullName.charAt(0).toUpperCase()}
              </span>
              <span className="kdash-topbar-meta">
                <span className="kdash-topbar-name">{identity.fullName}</span>
                <span className="kdash-topbar-role">District Officer</span>
              </span>
            </button>
          </div>
        </header>

        <div className="kdash-body">
          {notice && (
            <div className="kdash-notice">
              <BadgeCheck size={16} />
              <span>{notice}</span>
            </div>
          )}

          {profileError && (
            <div className="kdash-error">
              <AlertTriangle size={17} />
              <div>
                <h3>Profile could not be loaded</h3>
                <p>
                  Your session may have expired. Sign out and sign in again to
                  restore full access.
                </p>
              </div>
            </div>
          )}

          {!token && (
            <div className="kdash-error">
              <AlertTriangle size={17} />
              <div>
                <h3>Session not found</h3>
                <p>Please sign out and sign in again.</p>
              </div>
            </div>
          )}

          {currentView === "overview" && (
            <OverviewView
              key={`overview-${refreshKey}`}
              identity={identity}
              loadingProfile={!profile && !profileError}
              onOpenDesk={() => go("desk")}
              onOpenTeams={() => go("teams")}
              onOpenIncident={(reportId) => go("response", { incident: reportId })}
            />
          )}

          {currentView === "teams" &&
            (!profile && !profileError ? (
              <div className="kdash-loading">
                <Loader2 className="kdash-spin" size={17} /> Reading your
                assignment…
              </div>
            ) : (
              /* Keyed by district so the board opens on the right scope even
                 when the profile arrives after this view is first shown. */
              <KaveeshaDistrictRescueBoard
                key={`teams-${identity.district}-${refreshKey}`}
                token={token}
                homeDistrict={identity.district}
              />
            ))}

          {currentView === "desk" &&
            (!profile && !profileError ? (
              <div className="kdash-loading">
                <Loader2 className="kdash-spin" size={17} /> Reading your
                assignment…
              </div>
            ) : token ? (
              /* The desk reads incidents, never raw citizen reports: verification
                 is the DMC officer's own screen and this one must not duplicate it.
                 Keyed by district so it never opens on the wrong scope when the
                 profile arrives late. */
              <KaveeshaIncidentDesk
                key={`desk-${identity.district}-${refreshKey}`}
                token={token}
                district={identity.district}
                onOpenIncident={(reportId) => go("response", { incident: reportId })}
              />
            ) : null)}

          {currentView === "response" &&
            (!profile && !profileError ? (
              <div className="kdash-loading">
                <Loader2 className="kdash-spin" size={17} /> Reading your
                assignment…
              </div>
            ) : token && responseReport ? (
              /* One incident only. The teams sent are read live straight under the
                 map, and the teams still free are listed below them, so a delayed
                 team never blocks tasking a second one. */
              <KaveeshaIncidentResponse
                key={`response-${responseReport}-${refreshKey}`}
                token={token}
                reportId={responseReport}
                district={identity.district}
                onBack={() => go("desk")}
              />
            ) : (
              /* Reached only by clicking an incident, so a page with no incident
                 behind it is a dead end — say so and put the officer back. */
              <div className="kdash-error">
                <AlertTriangle size={17} />
                <div>
                  <h3>No incident is open</h3>
                  <p>Choose an incident on the desk to work its response.</p>
                  <button
                    type="button"
                    className="kdash-btn"
                    style={{ marginTop: 10 }}
                    onClick={() => go("desk")}
                  >
                    Open the incident desk
                  </button>
                </div>
              </div>
            ))}

          {currentView === "shelter" &&
            (!profile && !profileError ? (
              <div className="kdash-loading">
                <Loader2 className="kdash-spin" size={17} /> Reading your
                assignment…
              </div>
            ) : (
              /* Keyed by district so the shelter area opens on the right scope
                 even when the profile arrives after this view is first shown. */
              <KaveeshaShelterArea
                key={`shelter-${identity.district}-${refreshKey}`}
                token={token}
                district={identity.district}
              />
            ))}

          {currentView === "profile" && <ProfileView identity={identity} />}
        </div>
      </main>

      <style>{APP_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewView({
  identity,
  loadingProfile,
  onOpenDesk,
  onOpenTeams,
  onOpenIncident,
}: {
  identity: OfficerIdentity;
  loadingProfile: boolean;
  onOpenDesk: () => void;
  onOpenTeams: () => void;
  /** Open one incident straight on its response page. */
  onOpenIncident: (reportId: string) => void;
}) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [force, setForce] = useState<DistrictRescueBoard | null>(null);

  const district = identity.district;

  /**
   * The rescue roster is only a supporting figure on the overview, so a failed
   * load keeps the placeholder instead of breaking the district summary. The
   * rescue force tab reports its own errors in full.
   */
  useEffect(() => {
    const boardToken = getStoredDmcToken();
    if (!boardToken) return;

    let cancelled = false;

    fetchDistrictRescueBoard(boardToken, "district")
      .then((result) => {
        if (!cancelled) setForce(result);
      })
      .catch(() => {
        if (!cancelled) setForce(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * Only verified incidents reach this screen. Whether a citizen's report is
   * true is decided by the DMC officer on their own bench; the district's
   * overview starts after that gate, which is why nothing here can verify or
   * reject anything.
   */
  useEffect(() => {
    if (!district) return;

    const boardToken = getStoredDmcToken();
    if (!boardToken) return;

    let cancelled = false;

    fetchIncidents(boardToken)
      .then((result) => {
        if (cancelled) return;
        setError(null);
        setIncidents(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(messageOf(loadError));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [district]);

  /* The wait has two honest ends: the incident read comes back, or the profile
     is read and has no district to ask for. Neither leaves a spinner running
     forever, and neither is set from inside the effect. */
  const noDistrict = !district && !loadingProfile;
  const loading = !ready && !noDistrict;

  const untaken = incidents.filter((incident) => !incident.acceptedAt);
  const urgent = untaken.filter(
    (incident) =>
      incident.immediateDanger ||
      incident.severityLevel === "HIGH" ||
      incident.severityLevel === "CRITICAL"
  );
  const teamsOut = incidents.reduce(
    (total, incident) => total + incident.liveDispatchCount,
    0
  );

  /*
   * The one chart on this page reads the whole desk in a single glance: how far
   * each verified incident has travelled. Waiting on the district, being worked,
   * or closed out — three stages, three slices, every incident in exactly one.
   */
  const inProgress = incidents.filter(
    (incident) => incident.acceptedAt && !incident.resolvedAt
  ).length;
  const closed = incidents.filter((incident) => incident.resolvedAt).length;

  const incidentMix: DonutSegment[] = [
    { label: "Awaiting your yes", value: untaken.length, color: Colors.amber },
    { label: "Being worked", value: inProgress, color: Colors.blue },
    { label: "Resolved", value: closed, color: Colors.success },
  ];

  /* The newest verification on the desk, footnoted under the chart: the numbers
     say where things stand, this says how recent they are. */
  const lastVerifiedAt = incidents.reduce<string | null>(
    (latest, incident) =>
      incident.verifiedAt &&
      (!latest || new Date(incident.verifiedAt) > new Date(latest))
        ? incident.verifiedAt
        : latest,
    null
  );

  /*
   * Cover per disaster type a citizen can report, matched off the roster.
   *
   * Every disaster is listed, including the ones with nobody able to answer
   * them: an officer comparing bar lengths should see the gap, not infer it
   * from a missing row. Organizations are counted from the matched teams — the
   * distinct registered bodies behind each disaster — so that figure is real
   * today and needs no new server field.
   */
  const coverage: CoverageRow[] = DISASTER_KINDS.map((kind, index) => {
    const Icon = kind.icon;

    const matched = teamsForDisaster(force?.teams ?? [], kind);

    const orgKeys = matched
      .map((card) => card.organization?.registrationId)
      .filter((id): id is string => Boolean(id));

    const available = matched.filter(
      (card) => card.availability === "AVAILABLE"
    ).length;
    const deployed = matched.filter(
      (card) => card.availability === "ON_DEPLOYMENT"
    ).length;

    const row: CoverageRow = {
      key: kind.code,
      label: kind.label,
      icon: <Icon size={14} />,
      teams: matched.length,
      available,
      deployed,
      resting: matched.length - available - deployed,
      organizations: new Set(orgKeys).size,
      members: matched.reduce((total, card) => total + card.members, 0),
    };

    return [index, row] as const;
  })
    /* Strongest cover first, otherwise in the order the reporting page lists
       the disasters, so the ones with a force waiting are the first thing read
       and the gaps fall together underneath rather than scattered between. */
    .sort(([aOrder, a], [bOrder, b]) =>
      b.teams - a.teams || b.available - a.available || aOrder - bOrder
    )
    .map(([, row]) => row);

  const coveredTypes = coverage.filter((row) => row.teams > 0).length;
  const uncovered = coverage.length - coveredTypes;

  /* Share of the roster that is idle-and-ready, out-and-working, or stood down. */
  const readiness = (() => {
    const teams = force?.summary.teams ?? 0;

    return {
      teams,
      rate: teams > 0 ? Math.round(((force?.summary.available ?? 0) / teams) * 100) : 0,
      available: force?.summary.available ?? 0,
      deployed: force?.summary.onDeployment ?? 0,
      resting: force?.summary.standingDown ?? 0,
    };
  })();

  const shareOf = (part: number, whole: number) =>
    `${whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0}%`;

  return (
    <div className="kdash-stack">
      <section className="kdash-hero">
        <div className="kdash-hero-text">
          <div className="kdash-hero-greeting">
            <CalendarClock size={13} />
            {greeting()}, {identity.fullName.split(" ")[0]}
          </div>
          <h2 className="kdash-hero-title">
            <MapPin size={23} />
            {district ? `${district} District` : "Your district"}
          </h2>
          <p className="kdash-hero-sub">
            {loading || loadingProfile
              ? "Reading the latest district data…"
              : incidents.length === 0
                ? "Nothing verified is on your desk right now. This page fills in as the DMC clears reports for your district."
                : `The ${incidents.length} incident${
                    incidents.length === 1 ? "" : "s"
                  } the DMC has verified for your district, live.`}
          </p>
        </div>
        <div className="kdash-hero-badge">
          <ShieldCheck size={26} />
          <div>
            <div className="kdash-hero-badge-label">Clearance</div>
            <div className="kdash-hero-badge-value">
              {identity.clearanceLevel || "District Officer"}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="kdash-error">
          <AlertTriangle size={17} />
          <div>
            <h3>Live data could not be loaded</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {noDistrict && (
        <div className="kdash-error">
          <AlertTriangle size={17} />
          <div>
            <h3>No district assigned</h3>
            <p>
              Your account has no assigned district on file. Contact the Super
              Admin to complete your assignment.
            </p>
          </div>
        </div>
      )}

      {district && (
        <>
          <div className="kdash-stat-grid">
            <StatCard
              tone="warning"
              icon={<Inbox size={21} />}
              value={loading ? "—" : untaken.length}
              label="Awaiting your yes"
              hint="Not taken on yet"
            />
            <StatCard
              tone="critical"
              icon={<AlertTriangle size={21} />}
              value={loading ? "—" : urgent.length}
              label="Danger to life"
              hint="High, critical or immediate"
            />
            <StatCard
              tone="success"
              icon={<ShieldCheck size={21} />}
              value={loading ? "—" : incidents.length - untaken.length}
              label="Taken on"
              hint="The district is working these"
            />
            <StatCard
              tone="info"
              icon={<CalendarClock size={21} />}
              value={loading ? "—" : teamsOut}
              label="Teams in the field"
              hint="Deployments live right now"
            />
          </div>

          <div className="kdash-two-col">
            <section className="kdash-panel kdash-desk-panel">
              <div className="kdash-panel-head">
                <div>
                  <h2>Waiting for the district's yes</h2>
                  <p className="kdash-panel-sub">
                    Verified incidents you have not taken on yet
                  </p>
                </div>
                <div className="kdash-panel-actions">
                  <span className="kdash-panel-tag">
                    {loading ? "…" : `${untaken.length} open`}
                  </span>
                  <button
                    type="button"
                    className="kdash-btn kdash-btn-primary"
                    onClick={onOpenDesk}
                  >
                    Open incident desk
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="kdash-loading">
                  <Loader2 className="kdash-spin" size={17} /> Reading your
                  incidents…
                </div>
              ) : incidents.length === 0 ? (
                <div className="kdash-empty-state">
                  <div className="kdash-empty-icon">
                    <Inbox size={20} />
                  </div>
                  <h3>Nothing has reached your desk yet</h3>
                  <p>
                    Citizen reports are cleared by the DMC officer first, and
                    only what they verify appears here for {district}.
                  </p>
                </div>
              ) : untaken.length === 0 ? (
                <div className="kdash-empty-state kdash-empty-state-ok">
                  <div className="kdash-empty-icon">
                    <CheckCircle2 size={20} />
                  </div>
                  <h3>Your desk is clear</h3>
                  <p>
                    Every verified incident has been taken on. Open one to task a
                    team and watch it live.
                  </p>
                </div>
              ) : (
                <div className="kdash-report-list">
                  {untaken.slice(0, 3).map((incident) => (
                    <CompactIncidentRow
                      key={incident.id}
                      incident={incident}
                      onOpen={() => onOpenIncident(incident.reportId)}
                    />
                  ))}
                  {untaken.length > 3 && (
                    <button
                      type="button"
                      className="kdash-more"
                      onClick={onOpenDesk}
                    >
                      Take the other {untaken.length - 3} on at the desk
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="kdash-panel kdash-chart-panel">
              <div className="kdash-panel-head">
                <div>
                  <h2>District incident mix</h2>
                  <p className="kdash-panel-sub">
                    How far each verified incident has travelled
                  </p>
                </div>
                <span className="kdash-panel-tag">
                  {incidents.length} verified
                </span>
              </div>

              {loading ? (
                <div className="kdash-loading">
                  <Loader2 className="kdash-spin" size={17} /> Reading your
                  incidents…
                </div>
              ) : incidents.length === 0 ? (
                <p className="kdash-empty">
                  Nothing verified has reached {district} yet. This chart fills
                  in as incidents arrive and you work them.
                </p>
              ) : (
                <div className="kdash-chart-body">
                  <CapacityDonutChart
                    segments={incidentMix}
                    centerLabel={String(incidents.length)}
                    emptyLabel="No incidents to plot yet."
                  />
                </div>
              )}

              {!loading && lastVerifiedAt && (
                <p className="kdash-chart-note">
                  <CalendarClock size={12} />
                  Last verified {relativeTime(lastVerifiedAt)}
                </p>
              )}
            </section>
          </div>

          <section className="kdash-panel kdash-force">
            <div className="kdash-panel-head">
              <div className="kdash-force-title">
                <span className="kdash-force-medallion">
                  <Users size={17} />
                </span>
                <div>
                  <h2>
                    Rescue force{district ? ` in ${district}` : ""}
                  </h2>
                  <p className="kdash-panel-sub">
                    Who is ready to move, and where the cover runs thin
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="kdash-btn kdash-btn-primary"
                onClick={onOpenTeams}
              >
                Open rescue board
              </button>
            </div>

            {force ? (
              <>
                {/* The roster's own counts come first, straight under the title:
                    they are the four numbers the officer is asked for on the
                    phone, and every chart under them is a breakdown of them. */}
                <div className="kdash-force-rail">
                  <ForceCell
                    value={force.summary.teams}
                    label="Verified teams"
                    icon={<ShieldCheck size={13} />}
                  />
                  <ForceCell
                    value={force.summary.members}
                    label="Reported rescuers"
                    icon={<Users size={13} />}
                  />
                  <ForceCell
                    value={force.summary.organizations}
                    label="Organizations"
                    icon={<Building2 size={13} />}
                  />
                  <ForceCell
                    value={coveredTypes}
                    label="Disasters covered"
                    icon={<BadgeCheck size={13} />}
                  />
                </div>

                <div className="kdash-force-body">
                  <div className="kdash-force-ready">
                    <div className="kdash-force-rate">
                      <span className="kdash-force-rate-value">
                        {readiness.rate}
                        <i>%</i>
                      </span>
                      <span className="kdash-force-rate-cap">
                        of the force ready now
                      </span>
                    </div>

                    <div
                      className="kdash-force-meter"
                      role="img"
                      aria-label={`${readiness.available} of ${readiness.teams} teams available now`}
                    >
                      <span
                        className="kdash-force-seg kdash-force-seg-available"
                        style={{
                          width: shareOf(readiness.available, readiness.teams),
                        }}
                      />
                      <span
                        className="kdash-force-seg kdash-force-seg-deployed"
                        style={{
                          width: shareOf(readiness.deployed, readiness.teams),
                        }}
                      />
                      <span
                        className="kdash-force-seg kdash-force-seg-resting"
                        style={{
                          width: shareOf(readiness.resting, readiness.teams),
                        }}
                      />
                    </div>

                    <div className="kdash-force-legend">
                      <span>
                        <i className="kdash-force-dot kdash-force-dot-available" />
                        Available
                        <b>{readiness.available}</b>
                      </span>
                      <span>
                        <i className="kdash-force-dot kdash-force-dot-deployed" />
                        On deployment
                        <b>{readiness.deployed}</b>
                      </span>
                      <span>
                        <i className="kdash-force-dot kdash-force-dot-resting" />
                        Stood down
                        <b>{readiness.resting}</b>
                      </span>
                    </div>

                    {/* The gap callout belongs under the meter rather than under
                        the chart: it is a fact about the whole force, and it
                        keeps the short column from ending in empty space. */}
                    {uncovered > 0 && (
                      <p className="kdash-force-gap">
                        <AlertTriangle size={13} />
                        {uncovered} of the {coverage.length} disaster types
                        citizens report have no team able to answer them in{" "}
                        {district || "your"} district. The rescue board is where
                        mutual aid from a neighbouring district is pulled in.
                      </p>
                    )}
                  </div>

                  <div className="kdash-force-coverage">
                    <div className="kdash-force-coverage-head">
                      <h3>Cover by disaster type</h3>
                      <span className="kdash-force-coverage-count">
                        {coverage.length} types · {uncovered} uncovered
                      </span>
                    </div>

                    <DisasterCoverageChart
                      rows={coverage}
                      availableColor={FORCE_COVER.available}
                      deployedColor={FORCE_COVER.deployed}
                      restingColor={FORCE_COVER.resting}
                    />
                  </div>
                </div>

                <p className="kdash-force-note">
                  Only teams their organization admin or a Super Admin has
                  verified reach this force, and the counts above take each of
                  them once. The chart reads the same roster by disaster: a crew
                  is drawn under the disasters its own discipline and recorded
                  capabilities name, so the bars say who could be sent when that
                  report arrives and an empty row means nobody in this district
                  registered for it. Open the rescue board to search by disaster,
                  contact a team leader, or switch to mutual aid when your own
                  district is stretched.
                </p>
              </>
            ) : (
              <div className="kdash-loading">
                <Loader2 className="kdash-spin" size={17} /> Reading the rescue
                roster…
              </div>
            )}
          </section>
        </>
      )}

      {/* The overview's incident rows are styled by their own block, loaded
          alongside the overview's so a row is never painted unstyled. */}
      <style>{`${OVERVIEW_STYLES}${INCIDENT_ROW_STYLES}`}</style>
    </div>
  );
}

function ForceCell({
  value,
  label,
  icon,
  tone = "info",
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <div className={`kdash-force-cell kdash-force-cell-${tone}`}>
      <div className="kdash-force-value">{value}</div>
      <div className="kdash-force-label">
        <span className="kdash-force-glyph">{icon}</span>
        {label}
      </div>
    </div>
  );
}

function DistrictIdentityPanel({ identity }: { identity: OfficerIdentity }) {
  return (
    <section className="kdash-panel kdash-identity">
      <h2>My assignment</h2>

      <div className="kdash-identity-district">
        <MapPin size={18} />
        <div>
          <div className="kdash-identity-label">Assigned district</div>
          <div className="kdash-identity-value">
            {identity.district || "Not assigned"}
          </div>
        </div>
      </div>

      {/* Contact detail lives on the profile card above this one; what is said
          here is only what the assignment itself carries. */}
      <dl className="kdash-identity-list">
        <div>
          <dt>Officer ID</dt>
          <dd>{identity.officerId || "—"}</dd>
        </div>
        <div>
          <dt>Clearance level</dt>
          <dd>{identity.clearanceLevel || "—"}</dd>
        </div>
      </dl>

      <div className="kdash-identity-label" style={{ marginBottom: 8 }}>
        Divisional secretariats covered
      </div>
      {identity.secretariats.length === 0 ? (
        <p className="kdash-empty">Whole district</p>
      ) : (
        <div className="kdash-chip-row">
          {identity.secretariats.map((name) => (
            <span key={name} className="kdash-chip">
              {name}
            </span>
          ))}
        </div>
      )}

      <p className="kdash-shared-note">
        Incidents are scoped to your district — every officer assigned to{" "}
        {identity.district || "this district"} sees the same desk, so a verified
        incident is taken on even when you are off shift.
      </p>
    </section>
  );
}

/*
 * One incident the district has not taken on yet, said in a line. It is a
 * reading of the desk, not a decision point: verifying citizen reports belongs
 * to the DMC officer's own bench, so the row carries the officer straight to the
 * incident's response page, where the yes is given and a team is tasked.
 */
function CompactIncidentRow({
  incident,
  onOpen,
}: {
  incident: IncidentSummary;
  onOpen: () => void;
}) {
  const severity = incident.severityLevel.toLowerCase();

  return (
    <article className={`kdash-report kdash-report-${severity}`}>
      <button type="button" className="kdash-report-row" onClick={onOpen}>
        <span className="kdash-report-main">
          <span className="kdash-report-top">
            <span
              className={`kdash-pill kdash-pill-${severity}`}
            >
              {incident.severityLevel}
            </span>
            <span className="kdash-report-title">
              {humanize(incident.hazardType)}
            </span>
            {incident.immediateDanger && (
              <span className="kdash-report-danger">
                <AlertTriangle size={11} />
                Danger to life
              </span>
            )}
          </span>

          <span className="kdash-report-note">
            {incident.landmark || incident.description.slice(0, 96)}
          </span>

          <span className="kdash-report-meta">
            <span className="kdash-report-chip">{incident.reportId}</span>
            <span className="kdash-report-chip">
              verified{" "}
              {incident.verifiedAt
                ? relativeTime(incident.verifiedAt)
                : "recently"}
            </span>
            {incident.reporterName && (
              <span className="kdash-report-chip">
                {incident.reporterName}
              </span>
            )}
          </span>
        </span>

        <span className="kdash-report-go" aria-hidden="true">
          <ChevronRight size={16} />
        </span>
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function ProfileView({ identity }: { identity: OfficerIdentity }) {
  return (
    <div className="kdash-stack">
      <section className="kdash-panel kdash-profile-card">
        <div className="kdash-profile-top">
          <div className="kdash-avatar kdash-avatar-lg">
            {identity.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2>{identity.fullName}</h2>
            <p className="kdash-muted">District Officer · SafePlus DMC</p>
            <div className="kdash-chip-row" style={{ marginTop: 10 }}>
              <span className="kdash-chip kdash-chip-accent">
                <ShieldCheck size={11} />
                {identity.clearanceLevel || "District Officer"}
              </span>
              {identity.district && (
                <span className="kdash-chip">
                  <MapPin size={11} />
                  {identity.district}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="kdash-identity-list kdash-identity-list-wide">
          <div>
            <dt>Full name</dt>
            <dd>{identity.fullName}</dd>
          </div>
          <div>
            <dt>Official email</dt>
            <dd>{identity.email || "—"}</dd>
          </div>
          <div>
            <dt>Duty phone</dt>
            <dd>{identity.dutyPhone || "—"}</dd>
          </div>
          <div>
            <dt>Assigned district</dt>
            <dd>{identity.district || "Not assigned"}</dd>
          </div>
        </dl>
      </section>

      {/* The assignment the officer was given now lives here rather than on the
          overview, where it read as a fourth panel competing with the desk. */}
      <DistrictIdentityPanel identity={identity} />

      <style>{PROFILE_STYLES}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function StatCard({
  tone,
  icon,
  value,
  label,
  hint,
}: {
  tone: "critical" | "warning" | "info" | "success";
  icon: React.ReactNode;
  value: number | string;
  label: string;
  hint?: string;
}) {
  return (
    <div className={`kdash-stat kdash-stat-${tone}`}>
      <span className="kdash-stat-accent" aria-hidden="true" />
      <div className="kdash-stat-icon">{icon}</div>
      <div className="kdash-stat-body">
        <div className="kdash-stat-value">{value}</div>
        <div className="kdash-stat-label">{label}</div>
        {hint && <div className="kdash-stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function relativeTime(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/*
 * Numbers, IDs and stamps are set in the same monospace the DMC officer console
 * uses. It is what makes a wall of figures read as instrumentation instead of
 * as prose, and it lines counts up in a column without any tabular-nums tricks.
 */
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const APP_STYLES = `
  .kdash-app {
    display: flex;
    min-height: 100vh;
    background: ${Colors.white};
    color: ${Colors.text};
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.5;
    text-align: left;
    color-scheme: light;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .kdash-app *,
  .kdash-app *::before,
  .kdash-app *::after {
    box-sizing: border-box;
  }

  .kdash-sidebar {
    width: 272px;
    background: ${Colors.navy};
    color: ${Colors.white};
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 240ms ease;
  }

  .kdash-sidebar-closed {
    width: 74px;
  }

  .kdash-sidebar-head {
    padding: 22px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .kdash-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .kdash-brand-mark {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    background: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(21, 112, 239, 0.4);
  }

  .kdash-brand-name {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.03em;
    white-space: nowrap;
  }

  .kdash-brand-name span {
    color: ${Colors.blue};
  }

  .kdash-brand-sub {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #98a2b3;
    margin-top: 2px;
    white-space: nowrap;
  }

  .kdash-icon-button {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: ${Colors.white};
    width: 30px;
    height: 30px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kdash-icon-button:hover {
    background: rgba(255, 255, 255, 0.14);
  }

  .kdash-district-chip {
    margin: 0 18px 6px;
    padding: 8px 12px;
    border-radius: 9px;
    background: rgba(21, 112, 239, 0.16);
    border: 1px solid rgba(21, 112, 239, 0.45);
    color: ${Colors.blueLight};
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    overflow: hidden;
  }

  .kdash-nav {
    flex: 1;
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kdash-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 13px;
    border: none;
    background: transparent;
    color: #98a2b3;
    font-size: 13px;
    font-weight: 600;
    border-radius: 9px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
  }

  .kdash-nav-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: ${Colors.white};
  }

  .kdash-nav-item-active {
    background: ${Colors.blue};
    color: ${Colors.white};
    box-shadow: 0 4px 12px rgba(21, 112, 239, 0.35);
  }

  .kdash-sidebar-closed .kdash-nav-item span,
  .kdash-sidebar-closed .kdash-brand-text,
  .kdash-sidebar-closed .kdash-district-chip,
  .kdash-sidebar-closed .kdash-officer-meta,
  .kdash-sidebar-closed .kdash-logout span {
    display: none;
  }

  .kdash-sidebar-foot {
    padding: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .kdash-officer {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 14px;
  }

  .kdash-avatar {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .kdash-officer-name {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .kdash-officer-role {
    font-size: 10px;
    color: #98a2b3;
    margin-top: 2px;
  }

  .kdash-logout {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 11px 13px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: transparent;
    color: #fda29b;
    font-size: 12px;
    font-weight: 700;
    border-radius: 9px;
    cursor: pointer;
  }

  .kdash-logout:hover {
    background: rgba(217, 45, 32, 0.15);
    border-color: ${Colors.red};
    color: ${Colors.red};
  }

  .kdash-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  /* Scrolls away with the page rather than pinning itself: the officer is
     already told who and where they are by the sidebar, so a sticky bar here
     only costs the desk its vertical space. */
  .kdash-topbar {
    position: relative;
    padding: 18px 38px 17px;
    background: linear-gradient(180deg, ${Colors.white} 0%, #fbfcfe 100%);
    border-bottom: 1px solid #e9edf2;
    box-shadow: 0 8px 22px -20px rgba(16, 24, 40, 0.45);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  /* A hairline of brand colour runs the width of the header, so the bar closes
     like an instrument panel instead of ending on a plain grey rule. */
  .kdash-topbar::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: linear-gradient(
      90deg,
      ${Colors.navy} 0%,
      ${Colors.blue} 40%,
      rgba(21, 112, 239, 0) 100%
    );
    opacity: 0.5;
  }

  /* A mono eyebrow names the console, so the title below it is read as a place
     rather than as a page heading out of a document. */
  .kdash-topbar-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
    font-family: ${Mono};
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: ${Colors.success};
    box-shadow: 0 0 0 3px rgba(18, 183, 106, 0.15);
    flex-shrink: 0;
  }

  .kdash-topbar-titles h1 {
    font-size: 27px;
    font-weight: 800;
    letter-spacing: -0.035em;
    color: ${Colors.navy};
    margin: 0 0 5px;
  }

  .kdash-topbar-titles p {
    font-size: 13px;
    color: ${Colors.muted};
    margin: 0;
    max-width: 660px;
    line-height: 1.5;
  }

  .kdash-topbar-side {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .kdash-topbar-district {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    background: #f5f8ff;
    border: 1px solid #dce8fb;
    color: ${Colors.navy};
    font-size: 11.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .kdash-topbar-district svg {
    color: ${Colors.blue};
  }

  /* The officer is the account in the room, so it is said in full rather than
     hidden behind one letter of an avatar. */
  .kdash-topbar-user {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 15px 5px 5px;
    border-radius: 999px;
    border: 1px solid #e9edf2;
    background: ${Colors.white};
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .kdash-topbar-user:hover,
  .kdash-topbar-user-active {
    border-color: ${Colors.blue};
    background: #f7faff;
    box-shadow: 0 5px 16px -8px rgba(21, 112, 239, 0.45);
  }

  .kdash-topbar-avatar {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: linear-gradient(160deg, ${Colors.navyLight} 0%, ${Colors.navy} 100%);
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kdash-topbar-meta {
    display: flex;
    flex-direction: column;
    text-align: left;
    min-width: 0;
  }

  .kdash-topbar-name {
    font-size: 12.5px;
    font-weight: 700;
    color: ${Colors.navy};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
  }

  .kdash-topbar-role {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-top: 1px;
  }

  .kdash-body {
    flex: 1;
    padding: 32px 38px;
    overflow-y: auto;
  }

  .kdash-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px;
    margin-bottom: 18px;
    border-radius: 11px;
    background: #ecfdf3;
    border: 1px solid #a6f4c5;
    color: #067647;
    font-size: 13px;
    font-weight: 600;
  }

  .kdash-error,
  .kdash-loading {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 12px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 13px;
    line-height: 1.5;
  }

  .kdash-loading {
    align-items: center;
  }

  .kdash-error {
    border-color: ${Colors.red};
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .kdash-error h3 {
    margin: 0 0 3px;
    font-size: 14px;
  }

  .kdash-error p {
    margin: 0;
    font-size: 12px;
  }

  .kdash-spin {
    animation: kdash-spin 900ms linear infinite;
  }

  @keyframes kdash-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .kdash-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 37px;
    padding: 0 15px;
    border: 1px solid ${Colors.border};
    border-radius: 9px;
    background: ${Colors.white};
    color: ${Colors.text};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .kdash-btn:hover:not(:disabled) {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  /* Two classes on purpose: this block is injected before OVERVIEW_STYLES, and
     the plain .kdash-btn:hover rule would otherwise win on source order. */
  .kdash-btn.kdash-btn-primary {
    background: ${Colors.blue};
    border-color: ${Colors.blue};
    color: ${Colors.white};
    box-shadow: 0 4px 12px rgba(21, 112, 239, 0.28);
  }

  .kdash-btn.kdash-btn-primary:hover:not(:disabled) {
    background: ${Colors.blueDark};
    border-color: ${Colors.blueDark};
    color: ${Colors.white};
  }

  .kdash-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .kdash-fab-toggle,
  .kdash-scrim {
    display: none;
  }

  @media (max-width: 1024px) {
    .kdash-sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
    }

    .kdash-sidebar-closed {
      left: -272px;
      width: 272px;
    }

    .kdash-scrim {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(11, 31, 51, 0.45);
      z-index: 90;
    }

    .kdash-fab-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 110;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid ${Colors.border};
      background: ${Colors.white};
      color: ${Colors.navy};
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(16, 24, 40, 0.12);
    }

    .kdash-fab-toggle:hover {
      background: ${Colors.background};
    }

    .kdash-topbar,
    .kdash-body {
      padding: 20px;
    }

    .kdash-topbar {
      padding-left: 66px;
    }

    /* Space is worth more than the name here — the sidebar already says who
       the officer is. */
    .kdash-topbar-district,
    .kdash-topbar-meta {
      display: none;
    }

    .kdash-topbar-user {
      padding: 5px;
    }
  }
`;

const OVERVIEW_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kdash-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 30px 32px;
    border-radius: 20px;
    background: linear-gradient(118deg, ${Colors.navy} 0%, ${Colors.navyLight} 58%, #1c4a73 100%);
    border: 1px solid rgba(255, 255, 255, 0.07);
    box-shadow: 0 18px 44px -22px rgba(11, 31, 51, 0.65);
    color: ${Colors.white};
    position: relative;
    overflow: hidden;
  }

  .kdash-hero::after {
    content: "";
    position: absolute;
    right: -70px;
    top: -90px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(21, 112, 239, 0.38) 0%, rgba(21, 112, 239, 0) 70%);
    pointer-events: none;
  }

  /* A thin ring behind the glow gives the banner its quiet depth. */
  .kdash-hero::before {
    content: "";
    position: absolute;
    right: 96px;
    bottom: -110px;
    width: 210px;
    height: 210px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.1);
    pointer-events: none;
  }

  .kdash-hero-text {
    position: relative;
    z-index: 1;
    min-width: 0;
  }

  /* The greeting is a pill rather than a loose line, so it sits deliberately
     above the district name instead of floating next to it. */
  .kdash-hero-greeting {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 15px;
    padding: 6px 13px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #dbe7f5;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .kdash-hero-title {
    display: flex;
    align-items: center;
    gap: 11px;
    margin: 0 0 9px;
    font-size: 31px;
    font-weight: 800;
    letter-spacing: -0.038em;
    line-height: 1.15;
  }

  .kdash-hero-title svg {
    color: #7ab3ff;
    flex-shrink: 0;
  }

  .kdash-hero-sub {
    margin: 0;
    font-size: 13px;
    color: #cdd5df;
    max-width: 520px;
    line-height: 1.6;
  }

  .kdash-hero-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px 19px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(4px);
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .kdash-hero-badge-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .kdash-hero-badge-value {
    font-size: 13px;
    font-weight: 800;
    margin-top: 2px;
    max-width: 200px;
  }

  .kdash-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
  }

  .kdash-stat {
    position: relative;
    padding: 22px 22px 22px 27px;
    border-radius: 16px;
    background: ${Colors.white};
    border: 1px solid #e4e7ec;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 30px -18px rgba(16, 24, 40, 0.16);
    display: flex;
    align-items: center;
    gap: 16px;
    overflow: hidden;
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .kdash-stat:hover {
    transform: translateY(-3px);
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 18px 36px -16px rgba(16, 24, 40, 0.24);
  }

  /* The tone reads on a slim edge bar, so the card stays white and calm. */
  .kdash-stat-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 5px;
  }

  .kdash-stat-critical .kdash-stat-accent {
    background: linear-gradient(180deg, ${Colors.red} 0%, ${Colors.redDark} 100%);
  }

  .kdash-stat-warning .kdash-stat-accent {
    background: linear-gradient(180deg, ${Colors.amber} 0%, #dc7806 100%);
  }

  .kdash-stat-info .kdash-stat-accent {
    background: linear-gradient(180deg, ${Colors.blue} 0%, ${Colors.blueDark} 100%);
  }

  .kdash-stat-success .kdash-stat-accent {
    background: linear-gradient(180deg, ${Colors.success} 0%, #067647 100%);
  }

  .kdash-stat-icon {
    width: 50px;
    height: 50px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kdash-stat-critical .kdash-stat-icon {
    background: ${Colors.redLight};
    color: ${Colors.red};
  }

  .kdash-stat-warning .kdash-stat-icon {
    background: ${Colors.amberLight};
    color: ${Colors.amber};
  }

  .kdash-stat-info .kdash-stat-icon {
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-stat-success .kdash-stat-icon {
    background: #dcfae6;
    color: ${Colors.success};
  }

  .kdash-stat-body {
    min-width: 0;
  }

  .kdash-stat-value {
    font-family: ${Mono};
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: ${Colors.navy};
  }

  /* Counts are read as labels in this console: small, uppercase, tracked. */
  .kdash-stat-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-top: 5px;
    line-height: 1.35;
  }

  .kdash-stat-hint {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
    color: #98a2b3;
    margin-top: 3px;
  }

  .kdash-two-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 18px;
    align-items: stretch;
  }

  .kdash-panel {
    background: ${Colors.white};
    border: 1px solid #e4e7ec;
    border-radius: 16px;
    padding: 22px 24px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 30px -20px rgba(16, 24, 40, 0.16);
    min-width: 0;
  }

  .kdash-panel h2 {
    margin: 0;
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: ${Colors.navy};
  }

  .kdash-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid #eef1f5;
    flex-wrap: wrap;
  }

  /* A small pill for a panel's one headline number, so a heading always has
     its count next to it instead of buried in the body. */
  .kdash-panel-tag {
    padding: 4px 11px;
    border-radius: 999px;
    background: rgba(21, 112, 239, 0.08);
    border: 1px solid rgba(21, 112, 239, 0.2);
    color: ${Colors.blueDark};
    font-family: ${Mono};
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Every panel heading says what it is under it, so the eye is never handed a
     title without its meaning. */
  .kdash-panel-sub {
    margin: 4px 0 0;
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.5;
    color: ${Colors.muted};
  }

  .kdash-panel-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* A panel with nothing in it is still a designed state, not a bare sentence. */
  .kdash-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 34px 22px;
    border-radius: 14px;
    background: ${Colors.background};
    border: 1px dashed ${Colors.border};
  }

  .kdash-empty-state h3 {
    margin: 13px 0 0;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.navy};
  }

  .kdash-empty-state p {
    margin: 5px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: ${Colors.muted};
    max-width: 340px;
  }

  .kdash-empty-icon {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
  }

  .kdash-empty-state-ok {
    background: #f3fbf7;
    border-color: #a6f4c5;
  }

  .kdash-empty-state-ok .kdash-empty-icon {
    background: #dcfae6;
    border-color: transparent;
    color: ${Colors.success};
  }

  /* The desk and the chart sit side by side, so the desk's list and its empty
     state both stretch to fill the panel instead of leaving a short column. */
  .kdash-desk-panel {
    display: flex;
    flex-direction: column;
  }

  .kdash-desk-panel .kdash-report-list,
  .kdash-desk-panel .kdash-empty-state,
  .kdash-desk-panel .kdash-loading {
    flex: 1;
  }

  .kdash-chart-panel {
    display: flex;
    flex-direction: column;
    /* The chart hugs its own height rather than stretching to the desk panel
       beside it. The donut is a fixed size, so letting this card match a growing
       "waiting for your yes" list only added empty space around it; the desk
       still stretches to the row, the chart simply stays the size of its donut. */
    align-self: start;
  }

  .kdash-chart-panel .kdash-panel-head {
    margin-bottom: 16px;
  }

  /* While the queue is being read the placeholder owns the panel's height. */
  .kdash-chart-panel > .kdash-loading {
    flex: 1;
  }

  .kdash-chart-body {
    flex: 1;
    width: 100%;
  }

  .kdash-chart-panel > .kdash-empty {
    flex: 1;
  }

  .kdash-chart-note {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 16px 0 0;
    padding-top: 13px;
    border-top: 1px dashed #eaecf0;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.6;
    color: ${Colors.muted};
  }

  .kdash-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .kdash-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
    line-height: 1.65;
  }

  .kdash-more {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 12px 14px;
    border: 1px dashed ${Colors.border};
    border-radius: 12px;
    background: transparent;
    color: ${Colors.blue};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
  }

  .kdash-more:hover {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blueDark};
  }

  .kdash-more svg {
    transition: transform 160ms ease;
  }

  .kdash-more:hover svg {
    transform: translateX(3px);
  }

  /*
   * ---------------------------------------------------------------------
   * Rescue force
   *
   * Deliberately nothing like the stat boxes. A readiness meter, a ranked
   * hazard ledger divided from it by one hairline, and a footer of plain
   * counts. Colour is spent only on the meter segments and the hazard bars;
   * the single 42px figure is what gives the block its hierarchy.
   * ---------------------------------------------------------------------
   */
  .kdash-force-title {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  .kdash-force-medallion {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    background: linear-gradient(160deg, ${Colors.navyLight} 0%, ${Colors.navy} 100%);
    color: ${Colors.white};
    box-shadow: 0 8px 16px -10px rgba(11, 31, 51, 0.8),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    flex-shrink: 0;
  }

  .kdash-force-body {
    display: grid;
    grid-template-columns: minmax(240px, 310px) minmax(0, 1fr);
    gap: 30px;
    margin-top: 26px;
    align-items: start;
  }

  .kdash-force-ready {
    min-width: 0;
  }

  .kdash-force-rate {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 15px;
  }

  .kdash-force-rate-value {
    font-family: ${Mono};
    font-size: 42px;
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1;
    color: ${Colors.navy};
  }

  .kdash-force-rate-value i {
    font-style: normal;
    font-size: 20px;
    color: ${Colors.blue};
    margin-left: 1px;
  }

  .kdash-force-rate-cap {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .kdash-force-meter {
    display: flex;
    gap: 3px;
    height: 13px;
    padding: 2px;
    border-radius: 999px;
    background: #edf1f6;
    box-shadow: inset 0 1px 3px rgba(16, 24, 40, 0.12);
  }

  .kdash-force-seg {
    height: 100%;
    border-radius: 999px;
    min-width: 0;
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .kdash-force-seg-available {
    background: linear-gradient(180deg, ${FORCE_COVER.availableLight} 0%, ${FORCE_COVER.available} 100%);
  }

  .kdash-force-seg-deployed {
    background: linear-gradient(180deg, ${FORCE_COVER.deployedLight} 0%, ${FORCE_COVER.deployed} 100%);
  }

  .kdash-force-seg-resting {
    background: linear-gradient(180deg, ${FORCE_COVER.restingLight} 0%, ${FORCE_COVER.resting} 100%);
  }

  .kdash-force-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    margin-top: 13px;
    font-size: 11px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .kdash-force-legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .kdash-force-legend b {
    font-family: ${Mono};
    font-weight: 700;
    color: ${Colors.navy};
  }

  .kdash-force-dot {
    width: 8px;
    height: 8px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .kdash-force-dot-available {
    background: ${FORCE_COVER.available};
  }

  .kdash-force-dot-deployed {
    background: ${FORCE_COVER.deployed};
  }

  .kdash-force-dot-resting {
    background: ${FORCE_COVER.resting};
  }

  /* The cover column is the second half of the same composition, divided from
   * the meter by one hairline rather than being dropped into a panel of its own.
   * The chart draws its own rows (kaveesha-charts), so only the caption and the
   * gap note are styled here. */
  .kdash-force-coverage {
    min-width: 0;
    padding-left: 30px;
    border-left: 1px solid #eef1f5;
  }

  .kdash-force-coverage-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 10px;
  }

  .kdash-force-coverage-head h3 {
    margin: 0;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${Colors.navy};
  }

  .kdash-force-coverage-count {
    font-family: ${Mono};
    font-size: 10px;
    color: #98a2b3;
    white-space: nowrap;
  }

  /* A gap in cover is the one thing on this board that needs an action, so it is
   * the one thing in this section allowed a filled background. It sits at the
   * foot of the meter column, where the column has room to spare.
   */
  .kdash-force-gap {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 18px 0 0;
    padding: 11px 13px;
    border-radius: 11px;
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.55;
  }

  .kdash-force-gap svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${Colors.amber};
  }

  /* The roster's four counts, straight under the title and divided from the
     detail below by one hairline. They stay numbers with rules between them and
     never become boxes: the stat cards at the top of the page already own that
     shape, and these are a caption to the panel, not four more tiles. */
  .kdash-force-rail {
    display: flex;
    flex-wrap: wrap;
    gap: 14px 0;
    margin-top: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid #eef1f5;
  }

  .kdash-force-cell {
    position: relative;
    flex: 1 1 140px;
    padding: 0 18px;
    min-width: 0;
  }

  .kdash-force-cell:first-child {
    padding-left: 2px;
  }

  .kdash-force-cell:not(:first-child) {
    border-left: 1px solid #e6ebf2;
  }

  .kdash-force-cell::after {
    content: "";
    position: absolute;
    left: 2px;
    bottom: -8px;
    height: 2px;
    width: 0;
    border-radius: 2px;
    background: ${Colors.blue};
    transition: width 220ms ease;
  }

  .kdash-force-cell:hover::after {
    width: 28px;
  }

  .kdash-force-cell-success:hover::after {
    background: ${Colors.success};
  }

  .kdash-force-cell-warning:hover::after {
    background: ${Colors.amber};
  }

  .kdash-force-value {
    font-family: ${Mono};
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.035em;
    font-variant-numeric: tabular-nums;
    color: ${Colors.navy};
    line-height: 1.05;
  }

  .kdash-force-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 7px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.4;
    color: #8a94a6;
  }

  .kdash-force-glyph {
    display: inline-flex;
    flex-shrink: 0;
    color: ${Colors.blue};
  }

  .kdash-force-cell-success .kdash-force-glyph {
    color: #067647;
  }

  .kdash-force-cell-warning .kdash-force-glyph {
    color: ${Colors.amber};
  }

  .kdash-force-note {
    margin: 18px 0 0;
    padding-left: 13px;
    border-left: 2px solid #e4e7ec;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.65;
    color: ${Colors.muted};
  }

  @media (max-width: 1280px) {
    /* The cover chart takes the full panel width from here down. Beside the
       meter it needs about 480px before a bar has a length worth comparing and
       the names down its left still read whole; the 1440 desk has that room and
       a 13-inch laptop does not, so the two-column composition is drawn only
       where it actually fits. */
    .kdash-force-body {
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .kdash-force-coverage {
      padding-left: 0;
      border-left: none;
      padding-top: 20px;
      border-top: 1px solid #eef1f5;
    }
  }

  @media (max-width: 860px) {
    /* A grid track never shrinks below its min, so narrow screens are put on
       one column explicitly rather than left to overflow the panel. */
    .kdash-two-col {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .kdash-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 22px;
    }

    .kdash-hero-title {
      font-size: 25px;
    }

    .kdash-hero-greeting {
      margin-bottom: 12px;
    }

    /* The rail becomes a plain stacked list: the hairlines that divided it
       sideways have to become rules above each row instead. */
    .kdash-force-body {
      gap: 22px;
    }

    .kdash-force-cell {
      flex-basis: 100%;
      padding: 10px 0 0 2px;
      border-top: 1px solid #eef1f5;
    }

    /* Matched with the same :not(:first-child) weight the desktop rule uses,
       otherwise a stray vertical hairline is left at the edge of every stacked
       row — a plain class selector here would lose the specificity contest. */
    .kdash-force-cell:not(:first-child) {
      border-left: none;
    }

    .kdash-force-cell:first-child {
      border-top: none;
      padding-top: 0;
    }

    .kdash-force-cell::after {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .kdash-stat-grid {
      grid-template-columns: 1fr;
    }

    .kdash-panel {
      padding: 18px;
    }

    .kdash-force-rate-value {
      font-size: 36px;
    }
  }
`;

/*
 * Only the shape of a row the overview lists: one verified incident the
 * district has not taken on yet. The rest of the page is styled by APP_STYLES
 * and OVERVIEW_STYLES, and nothing here belongs to verification — that is the
 * DMC officer's own bench.
 */
const INCIDENT_ROW_STYLES = `
  .kdash-report-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kdash-report {
    position: relative;
    border: 1px solid #d1e9ff;
    border-radius: 13px;
    background: #f4f8ff;
    overflow: hidden;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .kdash-report:hover {
    transform: translateY(-1px);
  }

  /*
   * Severity is said by colouring the whole box. The stat cards above own the
   * accent-bar look, so these are deliberately a different family of object:
   * a tinted card whose edge and shadow deepen to the same colour on hover.
   *   LOW blue · MODERATE amber · HIGH deep amber · CRITICAL red
   */
  .kdash-report-low {
    background: #f4f8ff;
    border-color: #d1e9ff;
  }

  .kdash-report-low:hover {
    border-color: ${Colors.blue};
    box-shadow: 0 12px 26px -16px rgba(21, 112, 239, 0.55);
  }

  .kdash-report-moderate,
  .kdash-report-medium {
    background: #fffaeb;
    border-color: #fedf89;
  }

  .kdash-report-moderate:hover,
  .kdash-report-medium:hover {
    border-color: ${Colors.amber};
    box-shadow: 0 12px 26px -16px rgba(247, 144, 9, 0.55);
  }

  .kdash-report-high {
    background: #fff3e6;
    border-color: #fdb022;
  }

  .kdash-report-high:hover {
    border-color: #dc690a;
    box-shadow: 0 12px 26px -16px rgba(220, 105, 10, 0.55);
  }

  .kdash-report-critical {
    background: ${Colors.redLight};
    border-color: #fdb2ab;
  }

  .kdash-report-critical:hover {
    border-color: ${Colors.red};
    box-shadow: 0 12px 26px -16px rgba(217, 45, 32, 0.6);
  }

  .kdash-report-row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px 17px;
    border: none;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .kdash-report-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .kdash-report-top {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .kdash-report-title {
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.012em;
    color: ${Colors.navy};
  }

  /* A flag, not a sentence glued onto the title. White-on-tint, so it still
     stands out when the whole box is already the danger colour. */
  .kdash-report-danger {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid #fdb2ab;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
    color: ${Colors.redDark};
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .kdash-report-note {
    margin-top: 6px;
    font-size: 12.5px;
    line-height: 1.55;
    color: ${Colors.muted};
  }

  /* Reference detail belongs at the foot of the row, as quiet chips rather
     than one long dotted line an officer has to parse. */
  .kdash-report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 11px;
  }

  .kdash-report-chip {
    padding: 3px 9px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(16, 24, 40, 0.07);
    color: ${Colors.muted};
    font-size: 10.5px;
    font-weight: 700;
  }

  .kdash-report-go {
    align-self: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(16, 24, 40, 0.07);
    color: ${Colors.muted};
    flex-shrink: 0;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease,
      transform 160ms ease;
  }

  /* The chevron takes the severity colour on hover, so the whole box answers
     in one hue rather than turning generic blue. */
  .kdash-report:hover .kdash-report-go {
    color: ${Colors.white};
    border-color: transparent;
    transform: translateX(2px);
  }

  .kdash-report-low:hover .kdash-report-go {
    background: ${Colors.blue};
  }

  .kdash-report-moderate:hover .kdash-report-go,
  .kdash-report-medium:hover .kdash-report-go {
    background: ${Colors.amber};
  }

  .kdash-report-high:hover .kdash-report-go {
    background: #dc690a;
  }

  .kdash-report-critical:hover .kdash-report-go {
    background: ${Colors.red};
  }

  /* Severity pills stay white with a coloured edge: a tinted pill on a tinted
     card would simply vanish. */
  .kdash-pill {
    padding: 4px 11px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06);
    color: ${Colors.muted};
  }

  .kdash-pill-low {
    border-color: #b3d8fd;
    color: ${Colors.blue};
  }

  .kdash-pill-moderate,
  .kdash-pill-medium {
    border-color: #f9c554;
    color: ${Colors.amberText};
  }

  .kdash-pill-high {
    border-color: #fdb022;
    color: #b54708;
  }

  .kdash-pill-critical {
    border-color: #fdb2ab;
    color: ${Colors.redDark};
  }
`;

const PROFILE_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /*
   * The overview's style block unmounts when the officer leaves that view, so
   * anything this page renders has to be declared here as well. That is the one
   * rule of this file a reader has to hold: the blocks are per-view on purpose
   * and share nothing but APP_STYLES.
   */
  .kdash-panel {
    background: ${Colors.white};
    border: 1px solid #e4e7ec;
    border-radius: 16px;
    padding: 22px 24px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 30px -20px rgba(16, 24, 40, 0.16);
    min-width: 0;
  }

  .kdash-panel h2 {
    margin: 0;
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: ${Colors.navy};
  }

  .kdash-profile-card,
  .kdash-identity {
    max-width: 720px;
  }

  .kdash-identity > h2 {
    padding-bottom: 14px;
    margin-bottom: 16px;
    border-bottom: 1px solid #eef1f5;
  }

  .kdash-identity-district {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 14px 16px;
    margin: 14px 0 16px;
    border-radius: 12px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-identity-value {
    font-size: 16px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .kdash-identity-district .kdash-identity-value {
    color: ${Colors.navy};
  }

  .kdash-identity-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    margin: 0 0 6px;
  }

  .kdash-identity-list dt {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-bottom: 3px;
  }

  .kdash-identity-list dd {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${Colors.text};
    word-break: break-word;
  }

  .kdash-shared-note {
    margin: 16px 0 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: ${Colors.background};
    border-left: 3px solid ${Colors.blue};
    font-size: 12px;
    color: ${Colors.muted};
    line-height: 1.6;
  }

  .kdash-profile-top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding-bottom: 20px;
    margin-bottom: 20px;
    border-bottom: 1px solid ${Colors.border};
  }

  .kdash-avatar-lg {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 24px;
    flex-shrink: 0;
  }

  .kdash-profile-top h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.text};
  }

  .kdash-muted {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  .kdash-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .kdash-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 20px;
    background: ${Colors.background};
    border: 1px solid ${Colors.border};
    color: ${Colors.text};
    font-size: 11px;
    font-weight: 700;
  }

  .kdash-chip-accent {
    background: ${Colors.blueLight};
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .kdash-identity-list-wide {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px 20px;
    margin: 0;
  }

  .kdash-identity-list-wide dt {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
    margin-bottom: 3px;
  }

  .kdash-identity-list-wide dd {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: ${Colors.text};
    word-break: break-word;
  }

  .kdash-identity-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-empty {
    margin: 0;
    font-size: 13px;
    color: ${Colors.muted};
  }

  @media (max-width: 720px) {
    .kdash-identity-list {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 560px) {
    .kdash-profile-top {
      flex-direction: column;
      align-items: flex-start;
    }

    .kdash-panel {
      padding: 18px;
    }
  }
`;
