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
import { teamTypeIcon } from "../constants/kaveesha-rescueTeamOptions";
import KaveeshaDistrictRescueBoard from "../components/kaveesha-DistrictRescueBoard";
import KaveeshaIncidentDesk from "../components/kaveesha-IncidentDesk";
import KaveeshaIncidentResponse from "../components/kaveesha-IncidentResponse";
import KaveeshaShelterArea from "../components/kaveesha-ShelterArea";

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
            <h1>{VIEW_META[currentView].title}</h1>
            <p>{VIEW_META[currentView].subtitle}</p>
          </div>
          <button
            type="button"
            className={`kdash-profile-button ${
              currentView === "profile" ? "kdash-profile-button-active" : ""
            }`}
            onClick={() => go("profile")}
            aria-label="My profile"
            title="My profile"
          >
            {identity.fullName.charAt(0).toUpperCase()}
          </button>
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

  return (
    <div className="kdash-stack">
      <section className="kdash-hero">
        <div className="kdash-hero-text">
          <p className="kdash-hero-kicker">
            {greeting()}, {identity.fullName.split(" ")[0]}
          </p>
          <h2>{district ? `${district} District` : "Your district"}</h2>
          <p className="kdash-hero-sub">
            {loading || loadingProfile
              ? "Reading the latest district data…"
              : `${incidents.length} verified incident${
                  incidents.length === 1 ? "" : "s"
                } on your desk${
                  untaken.length > 0
                    ? ` — ${untaken.length} still need your yes${
                        urgent.length > 0
                          ? `, ${urgent.length} of them dangerous`
                          : ""
                      }`
                    : " — all of them taken on"
                }.`}
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
              label="Need your yes"
            />
            <StatCard
              tone="critical"
              icon={<AlertTriangle size={21} />}
              value={loading ? "—" : urgent.length}
              label="Danger to life"
            />
            <StatCard
              tone="success"
              icon={<ShieldCheck size={21} />}
              value={loading ? "—" : incidents.length - untaken.length}
              label="Taken on by the district"
            />
            <StatCard
              tone="info"
              icon={<CalendarClock size={21} />}
              value={loading ? "—" : teamsOut}
              label="Teams in the field"
            />
          </div>

          <div className="kdash-two-col">
            <section className="kdash-panel">
              <div className="kdash-panel-head">
                <h2>Waiting for the district's yes</h2>
                <button
                  type="button"
                  className="kdash-btn"
                  onClick={onOpenDesk}
                >
                  Open incident desk
                </button>
              </div>

              {loading ? (
                <div className="kdash-loading">
                  <Loader2 className="kdash-spin" size={17} /> Reading your
                  incidents…
                </div>
              ) : incidents.length === 0 ? (
                <p className="kdash-empty">
                  Nothing verified has reached {district} yet. Citizen reports
                  are cleared by the DMC officer first, and only what they verify
                  appears on your desk.
                </p>
              ) : untaken.length === 0 ? (
                <p className="kdash-empty">
                  Every incident on your desk has been taken on. Open one to task
                  a team and watch it live.
                </p>
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
                    </button>
                  )}
                </div>
              )}
            </section>

            <DistrictIdentityPanel identity={identity} />
          </div>

          <section className="kdash-panel kdash-force">
            <div className="kdash-panel-head">
              <h2>
                Rescue force{district ? ` in ${district}` : ""}
              </h2>
              <button
                type="button"
                className="kdash-btn"
                onClick={onOpenTeams}
              >
                Open rescue board
              </button>
            </div>

            {force ? (
              <>
                <div className="kdash-force-grid">
                  <ForceCell
                    value={force.summary.teams}
                    label="Verified teams"
                    icon={<ShieldCheck size={15} />}
                  />
                  <ForceCell
                    value={force.summary.available}
                    label="Available now"
                    tone="success"
                    icon={<CheckCircle2 size={15} />}
                  />
                  <ForceCell
                    value={force.summary.onDeployment}
                    label="On deployment"
                    tone="warning"
                    icon={<AlertTriangle size={15} />}
                  />
                  <ForceCell
                    value={force.summary.members}
                    label="Reported rescuers"
                    icon={<Users size={15} />}
                  />
                  <ForceCell
                    value={force.summary.organizations}
                    label="Organizations"
                    icon={<BadgeCheck size={15} />}
                  />
                </div>

                {force.disasters.length > 0 && (
                  <div className="kdash-force-disasters">
                    {force.disasters.map((item) => {
                      const Icon = teamTypeIcon(item.type);

                      return (
                        <span
                          key={item.type}
                          className="kdash-force-disaster"
                        >
                          <Icon size={13} />
                          <strong>{item.type}</strong>
                          <em>
                            {item.available}/{item.teams} free
                          </em>
                        </span>
                      );
                    })}
                  </div>
                )}

                <p className="kdash-force-note">
                  Only teams their organization admin or a Super Admin has
                  verified appear here. Open the rescue board to search by
                  disaster, contact a team leader, or switch to mutual aid when
                  your own district is stretched.
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
      <div className="kdash-force-icon">{icon}</div>
      <div className="kdash-force-value">{value}</div>
      <div className="kdash-force-label">{label}</div>
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

      <dl className="kdash-identity-list">
        <div>
          <dt>Officer ID</dt>
          <dd>{identity.officerId || "—"}</dd>
        </div>
        <div>
          <dt>Duty phone</dt>
          <dd>{identity.dutyPhone || "—"}</dd>
        </div>
        <div>
          <dt>Clearance level</dt>
          <dd>{identity.clearanceLevel || "—"}</dd>
        </div>
        <div>
          <dt>Official email</dt>
          <dd>{identity.email || "—"}</dd>
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
  return (
    <article className="kdash-report">
      <button type="button" className="kdash-report-row" onClick={onOpen}>
        <span
          className={`kdash-pill kdash-pill-${incident.severityLevel.toLowerCase()}`}
        >
          {incident.severityLevel}
        </span>

        <span className="kdash-report-main">
          <span className="kdash-report-title">
            {humanize(incident.hazardType)}
            {incident.immediateDanger ? " · danger to life" : ""}
          </span>
          <span className="kdash-report-meta">
            {incident.reportId} · verified{" "}
            {incident.verifiedAt ? relativeTime(incident.verifiedAt) : "recently"}
            {incident.reporterName ? ` · reported by ${incident.reporterName}` : ""}
          </span>
          <span className="kdash-report-note">
            {incident.landmark || incident.description.slice(0, 96)}
          </span>
        </span>

        <ChevronRight size={16} className="kdash-chevron" />
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
            <dt>Officer ID</dt>
            <dd>{identity.officerId || "—"}</dd>
          </div>
          <div>
            <dt>Duty phone</dt>
            <dd>{identity.dutyPhone || "—"}</dd>
          </div>
          <div>
            <dt>Assigned district</dt>
            <dd>{identity.district || "Not assigned"}</dd>
          </div>
          <div>
            <dt>Clearance level</dt>
            <dd>{identity.clearanceLevel || "—"}</dd>
          </div>
        </dl>

        <div className="kdash-identity-label" style={{ margin: "18px 0 8px" }}>
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
      </section>

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
}: {
  tone: "critical" | "warning" | "info" | "success";
  icon: React.ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <div className={`kdash-stat kdash-stat-${tone}`}>
      <div className="kdash-stat-icon">{icon}</div>
      <div>
        <div className="kdash-stat-value">{value}</div>
        <div className="kdash-stat-label">{label}</div>
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

const APP_STYLES = `
  .kdash-app {
    display: flex;
    min-height: 100vh;
    background: ${Colors.background};
    font-family: Inter, system-ui, -apple-system, sans-serif;
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

  .kdash-topbar {
    padding: 26px 38px;
    background: ${Colors.white};
    border-bottom: 1px solid ${Colors.border};
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .kdash-topbar-titles h1 {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: ${Colors.text};
    margin: 0 0 5px;
  }

  .kdash-topbar-titles p {
    font-size: 13px;
    color: ${Colors.muted};
    margin: 0;
  }

  .kdash-profile-button {
    width: 42px;
    height: 42px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: ${Colors.navy};
    color: ${Colors.white};
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 160ms ease, border-color 160ms ease;
  }

  .kdash-profile-button:hover,
  .kdash-profile-button-active {
    background: ${Colors.blue};
    border-color: ${Colors.blueDark};
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
    padding: 28px 30px;
    border-radius: 16px;
    background: linear-gradient(115deg, ${Colors.navy} 0%, ${Colors.navyLight} 100%);
    color: ${Colors.white};
    position: relative;
    overflow: hidden;
  }

  .kdash-hero::after {
    content: "";
    position: absolute;
    right: -70px;
    top: -70px;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: rgba(21, 112, 239, 0.22);
    pointer-events: none;
  }

  .kdash-hero-kicker {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${Colors.blueLight};
  }

  .kdash-hero h2 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
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
    padding: 14px 18px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
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
    grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
    gap: 15px;
  }

  .kdash-stat {
    padding: 20px;
    border-radius: 14px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    display: flex;
    align-items: center;
    gap: 15px;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .kdash-stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 22px rgba(16, 24, 40, 0.07);
  }

  .kdash-stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
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

  .kdash-stat-value {
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.text};
  }

  .kdash-stat-label {
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.muted};
    margin-top: 2px;
  }

  .kdash-two-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
    gap: 18px;
    align-items: start;
  }

  .kdash-panel {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    padding: 22px;
  }

  .kdash-panel h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .kdash-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 16px;
    flex-wrap: wrap;
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
    border: none;
    background: transparent;
    color: ${Colors.blue};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    padding: 10px 4px 2px;
    text-align: left;
  }

  .kdash-more:hover {
    color: ${Colors.blueDark};
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

  .kdash-identity-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-identity-value {
    font-size: 16px;
    font-weight: 800;
    color: ${Colors.text};
  }

  .kdash-identity-district .kdash-identity-value {
    color: ${Colors.navy};
  }

  .kdash-force-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: 12px;
    margin-top: 15px;
  }

  .kdash-force-cell {
    padding: 15px 16px;
    border-radius: 14px;
    border: 1px solid ${Colors.border};
    background: ${Colors.background};
  }

  .kdash-force-icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-bottom: 9px;
    border-radius: 9px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.blue};
  }

  .kdash-force-cell-success .kdash-force-icon {
    background: rgba(18, 183, 106, 0.14);
    border-color: transparent;
    color: #067647;
  }

  .kdash-force-cell-warning .kdash-force-icon {
    background: ${Colors.amberLight};
    border-color: transparent;
    color: ${Colors.amberText};
  }

  .kdash-force-value {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
    line-height: 1.1;
  }

  .kdash-force-label {
    margin-top: 3px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .kdash-force-disasters {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 14px;
  }

  .kdash-force-disaster {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.navy};
    font-size: 12px;
  }

  .kdash-force-disaster svg { color: ${Colors.blue}; }

  .kdash-force-disaster strong { font-weight: 800; }

  .kdash-force-disaster em {
    font-style: normal;
    color: ${Colors.muted};
    font-size: 11px;
    font-weight: 700;
  }

  .kdash-force-note {
    margin: 14px 0 0;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.65;
    color: ${Colors.muted};
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

  @media (max-width: 720px) {
    .kdash-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 22px;
    }

    .kdash-identity-list {
      grid-template-columns: 1fr;
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
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    overflow: hidden;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .kdash-report:hover {
    border-color: #b2c4d8;
    box-shadow: 0 6px 18px rgba(21, 112, 239, 0.07);
  }

  .kdash-report-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 15px 17px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .kdash-report-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .kdash-report-title {
    font-size: 14px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .kdash-report-meta {
    font-size: 12px;
    color: ${Colors.muted};
  }

  .kdash-report-note {
    font-size: 12px;
    color: ${Colors.muted};
    font-style: italic;
    margin-top: 3px;
  }

  .kdash-chevron {
    color: ${Colors.muted};
    flex-shrink: 0;
  }

  .kdash-pill {
    padding: 5px 11px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .kdash-pill-low {
    background: ${Colors.blueLight};
    color: ${Colors.blue};
  }

  .kdash-pill-moderate,
  .kdash-pill-medium {
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
  }

  .kdash-pill-high {
    background: #fde4c7;
    color: #b54708;
  }

  .kdash-pill-critical {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }
`;

const PROFILE_STYLES = `
  .kdash-stack {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kdash-profile-card {
    max-width: 720px;
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

  @media (max-width: 560px) {
    .kdash-profile-top {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;
