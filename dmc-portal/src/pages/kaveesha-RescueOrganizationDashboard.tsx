import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Gauge,
  Home,
  Layers,
  LifeBuoy,
  ListChecks,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Colors } from "../constants/theme";
import type { AuthUser } from "../types/auth";
import { getStoredDmcToken } from "../services/dmc-authApi";
import {
  approveRescueTeam,
  fetchRescueOrganizationDashboard,
  rejectRescueTeam,
  type RescueOrganizationDashboard,
  type RescueTeam,
} from "../services/kaveesha-rescueOrgApi";
import { teamTypeIcon } from "../constants/kaveesha-rescueTeamOptions";

interface RescueOrganizationDashboardProps {
  admin: AuthUser;
  onLogout: () => void;
}

type DashboardView = "overview" | "teams" | "organization";

const VIEW_META: Record<DashboardView, { title: string; subtitle: string }> = {
  overview: {
    title: "Organization overview",
    subtitle: "Verification status, readiness and the teams under your organization",
  },
  teams: {
    title: "Registered teams",
    subtitle: "Teams that reported this organization's registration ID",
  },
  organization: {
    title: "Organization profile",
    subtitle: "The details a Super Admin verified for this organization",
  },
};

const NAV: { view: DashboardView; label: string; icon: typeof Home }[] = [
  { view: "overview", label: "Overview", icon: Home },
  { view: "teams", label: "Teams", icon: Users },
  { view: "organization", label: "Organization", icon: Building2 },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Active", tone: "success" },
  PENDING_VERIFICATION: { label: "Pending review", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "neutral" };
}

export default function RescueOrganizationDashboard({
  admin,
  onLogout,
}: RescueOrganizationDashboardProps) {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const [data, setData] = useState<RescueOrganizationDashboard | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredDmcToken()));
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const token = getStoredDmcToken();
  const sessionMissing = !token;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchRescueOrganizationDashboard(token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "Dashboard could not be loaded.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const refresh = () => {
    setError(null);
    setBanner(null);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  /** Reload the roster after a decision and tell the admin what happened. */
  const teamReviewed = (message: string) => {
    setError(null);
    setBanner(message);
    setLoading(true);
    setRefreshKey((key) => key + 1);
  };

  /**
   * The disaster chosen on the overview. The teams view is remounted with it
   * so the admin lands straight on that disaster's roster.
   */
  const [teamDisaster, setTeamDisaster] = useState("all");

  const openDisasterTeams = (type: string) => {
    setTeamDisaster(type);
    setCurrentView("teams");
  };

  const adminName = data?.admin.fullName || admin.fullName || "Organization Admin";
  const organizationName = data?.organization.name || "Rescue organization";
  const initials = adminName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="rodash-app">
      <aside className="rodash-sidebar">
        <div className="rodash-brand">
          <div className="rodash-brand-mark">
            <LifeBuoy size={22} />
          </div>
          <div>
            <div className="rodash-brand-name">
              Safe<span>Plus</span>
            </div>
            <div className="rodash-brand-sub">RESCUE ORGANIZATION</div>
          </div>
        </div>

        <div className="rodash-org-card">
          <Building2 size={15} />
          <div>
            <div className="rodash-org-name">{organizationName}</div>
            {data && (
              <div className="rodash-org-meta">
                {data.organization.district} District
              </div>
            )}
          </div>
        </div>

        <nav className="rodash-nav">
          {NAV.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`rodash-nav-item ${
                currentView === item.view ? "rodash-nav-item-active" : ""
              }`}
              onClick={() => setCurrentView(item.view)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              <ChevronRight size={15} />
            </button>
          ))}
        </nav>

        <div className="rodash-sidebar-foot">
          <div className="rodash-admin">
            <div className="rodash-avatar">{initials || "RO"}</div>
            <div>
              <div className="rodash-admin-name">{adminName}</div>
              <div className="rodash-admin-role">
                {data?.admin.designation || "Organization Admin"}
              </div>
            </div>
          </div>
          <button type="button" className="rodash-logout" onClick={onLogout}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="rodash-main">
        <header className="rodash-topbar">
          <div>
            <h1>{VIEW_META[currentView].title}</h1>
            <p>{VIEW_META[currentView].subtitle}</p>
          </div>
          <button
            type="button"
            className="rodash-refresh"
            onClick={refresh}
            disabled={loading || sessionMissing}
          >
            <RefreshCw size={15} className={loading ? "rodash-spin" : ""} />
            <span>Refresh</span>
          </button>
        </header>

        <div className="rodash-body">
          {sessionMissing && (
            <div className="rodash-error">
              <AlertTriangle size={18} />
              <div>
                <h3>Session not found</h3>
                <p>
                  Your sign-in session could not be restored. Please sign out
                  and sign in again.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rodash-error">
              <AlertTriangle size={18} />
              <div>
                <h3>Could not load the dashboard</h3>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className="rodash-error-action"
                onClick={refresh}
              >
                Try again
              </button>
            </div>
          )}

          {banner && (
            <div className="rodash-banner">
              <BadgeCheck size={17} />
              <span>{banner}</span>
            </div>
          )}

          {loading && !data && (
            <div className="rodash-loading">
              <Loader2 size={22} className="rodash-spin" />
              <span>Loading organization data...</span>
            </div>
          )}

          {!loading && !sessionMissing && !error && data && currentView === "overview" && (
            <OverviewView
              data={data}
              adminName={adminName}
              onOpenDisaster={openDisasterTeams}
            />
          )}

          {!loading && !sessionMissing && !error && data && currentView === "teams" && (
            <TeamsView
              key={`teams-${teamDisaster}`}
              data={data}
              token={token ?? ""}
              initialDisaster={teamDisaster}
              onOpenOrganization={() => setCurrentView("organization")}
              onReviewed={teamReviewed}
            />
          )}

          {!loading && !sessionMissing && !error && data && currentView === "organization" && (
            <OrganizationView data={data} />
          )}
        </div>
      </main>

      <style>{CSS}</style>
    </div>
  );
}

function OverviewView({
  data,
  adminName,
  onOpenDisaster,
}: {
  data: RescueOrganizationDashboard;
  adminName: string;
  onOpenDisaster: (type: string) => void;
}) {
  const status = statusMeta(data.account.status);

  const coverage = useMemo(() => {
    const groups = new Map<
      string,
      { teams: number; available: number; members: number }
    >();

    data.teams.forEach((team) => {
      const type = teamDisaster(team);
      const group = groups.get(type) ?? {
        teams: 0,
        available: 0,
        members: 0,
      };

      group.teams += 1;
      group.members += team.memberCount;
      if (team.availability === "AVAILABLE" && team.status === "ACTIVE") {
        group.available += 1;
      }

      groups.set(type, group);
    });

    return [...groups.entries()]
      .map(([type, group]) => ({ type, ...group }))
      .sort((a, b) => b.teams - a.teams || a.type.localeCompare(b.type));
  }, [data.teams]);

  return (
    <>
      <section className="rodash-hero">
        <div className="rodash-hero-text">
          <span className={`rodash-pill rodash-pill-${status.tone}`}>
            <BadgeCheck size={13} />
            Organization {data.account.status === "ACTIVE" ? "verified" : status.label.toLowerCase()}
          </span>
          <h2>
            {greeting()}, {adminName.split(" ")[0]}
          </h2>
          <p>
            {data.organization.name} — {data.organization.type}. Registration ID{" "}
            <strong>{data.organization.registrationId}</strong>.
          </p>
        </div>
        <div className="rodash-hero-facts">
          <div className="rodash-fact">
            <MapPin size={14} />
            <span>{data.organization.district}</span>
          </div>
          <div className="rodash-fact">
            <CalendarClock size={14} />
            <span>
              {data.account.verifiedAt
                ? `Verified ${formatDate(data.account.verifiedAt)}`
                : `Registered ${formatDate(data.account.registeredAt)}`}
            </span>
          </div>
        </div>
      </section>

      <section className="rodash-stats">
        <StatCard
          icon={Users}
          tone="blue"
          label="Total teams"
          value={data.stats.totalTeams}
          caption="Linked to this registration ID"
        />
        <StatCard
          icon={ShieldCheck}
          tone="success"
          label="Active teams"
          value={data.stats.activeTeams}
          caption="Ready for tasking"
        />
        <StatCard
          icon={ClipboardList}
          tone="amber"
          label="Pending review"
          value={data.stats.pendingTeams}
          caption="Awaiting your decision"
        />
        <StatCard
          icon={Ban}
          tone="red"
          label="Rejected"
          value={data.stats.rejectedTeams}
          caption="Waiting for the leader to fix and resubmit"
        />
        <StatCard
          icon={Gauge}
          tone="navy"
          label="Available now"
          value={data.stats.availableTeams}
          caption="Marked available by their leader"
        />
        <StatCard
          icon={UserRound}
          tone="blue"
          label="Members"
          value={data.stats.totalMembers}
          caption="Reported across all teams"
        />
      </section>

      {coverage.length > 0 && (
        <section className="rodash-card rodash-disasters">
          <div className="rodash-card-head">
            <h3>Disaster response coverage</h3>
            <p>
              Pick a disaster to open only the teams registered for it, or see
              every team under {data.organization.name}
            </p>
          </div>

          <div className="rodash-disaster-grid">
            <button
              type="button"
              className="rodash-disaster-card rodash-disaster-card-all"
              onClick={() => onOpenDisaster("all")}
            >
              <div className="rodash-disaster-icon">
                <Layers size={18} />
              </div>
              <div className="rodash-disaster-body">
                <h4>All teams</h4>
                <p>
                  {data.teams.length} team{data.teams.length === 1 ? "" : "s"}{" "}
                  across {coverage.length} disaster type
                  {coverage.length === 1 ? "" : "s"}
                </p>
              </div>
              <ChevronRight size={16} className="rodash-disaster-arrow" />
            </button>

            {coverage.map((item) => {
              const Icon = teamTypeIcon(item.type);

              return (
                <button
                  key={item.type}
                  type="button"
                  className="rodash-disaster-card"
                  onClick={() => onOpenDisaster(item.type)}
                >
                  <div className="rodash-disaster-icon">
                    <Icon size={18} />
                  </div>
                  <div className="rodash-disaster-body">
                    <h4>{item.type}</h4>
                    <p>
                      {item.teams} team{item.teams === 1 ? "" : "s"} ·{" "}
                      {item.members} members
                    </p>
                    <span
                      className={`rodash-pill rodash-pill-${
                        item.available > 0 ? "success" : "neutral"
                      }`}
                    >
                      <BadgeCheck size={12} />
                      {item.available > 0
                        ? `${item.available} available now`
                        : "None available now"}
                    </span>
                  </div>
                  <ChevronRight size={16} className="rodash-disaster-arrow" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="rodash-grid">
        <div className="rodash-card">
          <div className="rodash-card-head">
            <h3>Operations readiness</h3>
            <p>How this organization is currently represented on the platform</p>
          </div>
          <div className="rodash-rows">
            <ReadinessRow
              label="Teams in the field"
              value={`${data.stats.activeTeams} active · ${data.stats.pendingTeams} pending`}
            />
            <ReadinessRow
              label="Reported manpower"
              value={`${data.stats.totalMembers} members`}
            />
            <ReadinessRow
              label="Home district"
              value={data.organization.district}
            />
            <ReadinessRow
              label="Official contact"
              value={data.organization.officialEmail}
            />
          </div>
        </div>

        <div className="rodash-card">
          <div className="rodash-card-head">
            <h3>Organization admin</h3>
            <p>The account signed in to this portal</p>
          </div>
          <div className="rodash-rows">
            <ReadinessRow label="Name" value={data.admin.fullName} />
            <ReadinessRow label="Designation" value={data.admin.designation} />
            <ReadinessRow label="Email" value={data.admin.email} />
            <ReadinessRow label="Phone" value={data.admin.phone} />
          </div>
        </div>
      </section>
    </>
  );
}

const TEAM_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All teams" },
  { key: "PENDING_VERIFICATION", label: "Waiting for my review" },
  { key: "ACTIVE", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
];

const AVAILABILITY_META: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  ON_DEPLOYMENT: { label: "On deployment", tone: "warning" },
  UNAVAILABLE: { label: "Not available", tone: "neutral" },
};

function availabilityMeta(value: string) {
  return AVAILABILITY_META[value] ?? { label: value, tone: "neutral" };
}

/**
 * A team's disaster discipline doubles as the tab it is filed under. Older
 * records can miss the field, so they stay reachable under a shared label
 * instead of disappearing from every filtered view.
 */
function teamDisaster(team: RescueTeam): string {
  return String(team.teamType ?? "").trim() || "Not specified";
}

function TeamsView({
  data,
  token,
  initialDisaster,
  onOpenOrganization,
  onReviewed,
}: {
  data: RescueOrganizationDashboard;
  token: string;
  initialDisaster: string;
  onOpenOrganization: () => void;
  onReviewed: (message: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [disaster, setDisaster] = useState(initialDisaster);
  const [decision, setDecision] = useState<{
    team: RescueTeam;
    mode: "approve" | "reject";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Disaster tabs are built from the teams actually attached to this org. */
  const disasters = useMemo(() => {
    const counts = new Map<string, number>();

    data.teams.forEach((team) => {
      const type = teamDisaster(team);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  }, [data.teams]);

  const visible = data.teams.filter(
    (team) =>
      (filter === "all" || team.status === filter) &&
      (disaster === "all" || teamDisaster(team) === disaster)
  );

  const filtersActive = filter !== "all" || disaster !== "all";

  /**
   * Each row of pills is counted against the other row's current choice, so
   * a badge never promises teams the other filter would then hide.
   */
  const statusCount = (key: string) =>
    data.teams.filter(
      (team) =>
        (key === "all" || team.status === key) &&
        (disaster === "all" || teamDisaster(team) === disaster)
    ).length;

  const disasterCount = (type: string) =>
    data.teams.filter(
      (team) =>
        (filter === "all" || team.status === filter) &&
        (type === "all" || teamDisaster(team) === type)
    ).length;

  const resetFilters = () => {
    setFilter("all");
    setDisaster("all");
  };

  if (data.teams.length === 0) {
    return (
      <section className="rodash-card rodash-empty">
        <div className="rodash-empty-icon">
          <Users size={26} />
        </div>
        <h3>No teams linked yet</h3>
        <p>
          Teams that register with the registration ID{" "}
          <strong>{data.organization.registrationId}</strong> appear here with
          their verification status.
        </p>
        <button type="button" className="rodash-link" onClick={onOpenOrganization}>
          Review organization details
          <ChevronRight size={15} />
        </button>
      </section>
    );
  }

  const openDecision = (team: RescueTeam, mode: "approve" | "reject") => {
    setActionError(null);
    setReason("");
    setReasonError(null);
    setDecision({ team, mode });
  };

  const closeDecision = () => {
    if (busy) return;
    setDecision(null);
    setReason("");
    setReasonError(null);
    setActionError(null);
  };

  const confirmDecision = async () => {
    if (!decision) return;

    if (!token) {
      setActionError("Your sign-in session is missing. Please sign in again.");
      return;
    }

    const trimmedReason = reason.trim();

    if (decision.mode === "reject" && trimmedReason.length < 5) {
      setReasonError(
        "Give the team leader a reason they can act on (at least 5 characters)."
      );
      return;
    }

    setBusy(true);
    setActionError(null);

    try {
      const result =
        decision.mode === "approve"
          ? await approveRescueTeam(token, decision.team.userId)
          : await rejectRescueTeam(token, decision.team.userId, trimmedReason);

      setBusy(false);
      setDecision(null);
      setReason("");
      onReviewed(result.message);
    } catch (cause: unknown) {
      setBusy(false);
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Your decision could not be saved. Please try again."
      );
    }
  };

  return (
    <>
      {data.stats.pendingTeams > 0 && (
        <div className="rodash-review-callout">
          <ClipboardList size={18} />
          <div>
            <strong>
              {data.stats.pendingTeams} team(s) waiting for your decision
            </strong>
            <p>
              Approve a team to make it visible to District Officers for
              tasking, or reject it with a reason so the leader can correct and
              resubmit.
            </p>
          </div>
        </div>
      )}

      <div className="rodash-filter-panel">
        <div className="rodash-filter-block">
          <div className="rodash-filter-caption">
            <SlidersHorizontal size={12} />
            <span>Review status</span>
          </div>
          <div className="rodash-filters">
            {TEAM_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`rodash-filter ${
                  filter === item.key ? "rodash-filter-active" : ""
                }`}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
                <span>{statusCount(item.key)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rodash-filter-block">
          <div className="rodash-filter-caption">
            <Layers size={12} />
            <span>Disaster response teams</span>
          </div>
          <div className="rodash-filters">
            <button
              type="button"
              className={`rodash-filter ${
                disaster === "all" ? "rodash-filter-active" : ""
              }`}
              onClick={() => setDisaster("all")}
            >
              All disasters
              <span>{disasterCount("all")}</span>
            </button>

            {disasters.map((item) => {
              const Icon = teamTypeIcon(item.type);

              return (
                <button
                  key={item.type}
                  type="button"
                  className={`rodash-filter ${
                    disaster === item.type ? "rodash-filter-active" : ""
                  }`}
                  onClick={() => setDisaster(item.type)}
                >
                  <Icon size={13} />
                  {item.type}
                  <span>{disasterCount(item.type)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rodash-filter-summary">
          <p>
            Showing <strong>{visible.length}</strong> of {data.teams.length}{" "}
            team{data.teams.length === 1 ? "" : "s"}
            {disaster === "all"
              ? ""
              : ` for ${disaster.toLowerCase()} operations`}
            {filter === "all"
              ? ""
              : ` · ${TEAM_FILTERS.find((item) => item.key === filter)?.label.toLowerCase()}`}
          </p>
          {filtersActive && (
            <button type="button" className="rodash-ghost" onClick={resetFilters}>
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rodash-error">
          <AlertTriangle size={18} />
          <div>
            <h3>Decision not saved</h3>
            <p>{actionError}</p>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <section className="rodash-card rodash-empty">
          <div className="rodash-empty-icon">
            <Users size={26} />
          </div>
          <h3>No teams in this view</h3>
          <p>
            Switch the filters above to see the rest of the teams registered
            under {data.organization.name}.
          </p>
          {filtersActive && (
            <button
              type="button"
              className="rodash-link"
              onClick={resetFilters}
            >
              Show every team
              <ChevronRight size={15} />
            </button>
          )}
        </section>
      ) : (
        <section className="rodash-team-grid">
          {visible.map((team) => {
            const meta = statusMeta(team.status);
            const availability = availabilityMeta(team.availability);
            const TypeIcon = teamTypeIcon(team.teamType);
            const hasBase =
              team.base.latitude !== null && team.base.longitude !== null;

            return (
              <article
                key={team.userId}
                className={`rodash-team-card rodash-team-card-${meta.tone}`}
              >
                <div className="rodash-team-head">
                  <div className="rodash-team-icon">
                    <TypeIcon size={18} />
                  </div>
                  <div className="rodash-team-heading">
                    <h4>{team.teamName}</h4>
                    <p>
                      {team.teamType} · {team.operatingDistrict} District
                    </p>
                  </div>
                  <span className={`rodash-pill rodash-pill-${meta.tone}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="rodash-team-leader">
                  <UserRound size={15} />
                  <div>
                    <div className="rodash-team-leader-name">
                      {team.leaderFullName}
                      {team.leaderDesignation
                        ? ` · ${team.leaderDesignation}`
                        : ""}
                    </div>
                    <div className="rodash-team-leader-contact">
                      <span>{team.leaderEmail}</span>
                      <span>{team.leaderPhone}</span>
                    </div>
                  </div>
                </div>

                <div className="rodash-team-facts">
                  <div className="rodash-team-fact">
                    <Users size={13} />
                    <span>{team.memberCount} members</span>
                  </div>
                  <div className="rodash-team-fact">
                    <Phone size={13} />
                    <span>{team.teamContactNumber}</span>
                  </div>
                  <div className="rodash-team-fact">
                    <Gauge size={13} />
                    <span>{availability.label}</span>
                  </div>
                  <div className="rodash-team-fact">
                    <CalendarClock size={13} />
                    <span>Registered {formatDate(team.registeredAt)}</span>
                  </div>
                </div>

                <div className="rodash-team-skills">
                  <div className="rodash-team-skill-block">
                    <div className="rodash-team-skill-label">
                      <ListChecks size={13} />
                      Capabilities
                    </div>
                    <div className="rodash-chip-row">
                      {team.capabilities.length > 0 ? (
                        team.capabilities.map((item) => (
                          <span key={item} className="rodash-chip">
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="rodash-chip-empty">None listed</span>
                      )}
                    </div>
                  </div>

                  <div className="rodash-team-skill-block">
                    <div className="rodash-team-skill-label">
                      <Package size={13} />
                      Equipment
                    </div>
                    <div className="rodash-chip-row">
                      {team.equipment.length > 0 ? (
                        team.equipment.map((item) => (
                          <span key={item} className="rodash-chip">
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="rodash-chip-empty">None listed</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rodash-team-base">
                  <MapPin size={13} />
                  <span>
                    {hasBase
                      ? `${team.base.label ?? "Base location"} · ${team.base.latitude?.toFixed(
                          5
                        )}, ${team.base.longitude?.toFixed(5)}`
                      : "No base location was saved"}
                  </span>
                </div>

                {team.status === "REJECTED" && team.rejectionReason && (
                  <div className="rodash-team-rejected">
                    <Ban size={14} />
                    <span>
                      <strong>You rejected this team:</strong>{" "}
                      {team.rejectionReason}
                      {team.reviewedAt
                        ? ` · ${formatDate(team.reviewedAt)}`
                        : ""}
                    </span>
                  </div>
                )}

                {team.status === "ACTIVE" && (
                  <div className="rodash-team-approved">
                    <BadgeCheck size={14} />
                    <span>
                      Verified by your organization
                      {team.reviewedAt ? ` on ${formatDate(team.reviewedAt)}` : ""}
                      {" · "}
                      {team.availability === "AVAILABLE"
                        ? "currently available to District Officers"
                        : "not currently marked available"}
                    </span>
                  </div>
                )}

                {team.status === "PENDING_VERIFICATION" && (
                  <div className="rodash-team-actions">
                    <button
                      type="button"
                      className="rodash-approve"
                      onClick={() => openDecision(team, "approve")}
                    >
                      <Check size={15} />
                      Approve team
                    </button>
                    <button
                      type="button"
                      className="rodash-reject"
                      onClick={() => openDecision(team, "reject")}
                    >
                      <Ban size={15} />
                      Reject
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {decision && (
        <div className="rodash-modal-backdrop" onClick={closeDecision}>
          <div
            className="rodash-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rodash-modal-head">
              <div
                className={`rodash-modal-icon ${
                  decision.mode === "approve"
                    ? "rodash-modal-icon-approve"
                    : "rodash-modal-icon-reject"
                }`}
              >
                {decision.mode === "approve" ? (
                  <BadgeCheck size={20} />
                ) : (
                  <Ban size={20} />
                )}
              </div>
              <div>
                <h3>
                  {decision.mode === "approve"
                    ? `Verify ${decision.team.teamName}?`
                    : `Reject ${decision.team.teamName}?`}
                </h3>
                <p>
                  {decision.team.leaderFullName} ·{" "}
                  {decision.team.operatingDistrict} District ·{" "}
                  {decision.team.memberCount} members
                </p>
              </div>
              <button
                type="button"
                className="rodash-modal-close"
                onClick={closeDecision}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="rodash-modal-body">
              {decision.mode === "approve" ? (
                <p className="rodash-modal-text">
                  The team becomes <strong>VERIFIED</strong>, the leader is
                  signed in to the portal and the mobile app, and District
                  Officers can see this team when they look for a team to task.
                  An email goes to{" "}
                  <strong>{decision.team.leaderEmail}</strong>.
                </p>
              ) : (
                <>
                  <label className="rodash-modal-label" htmlFor="rejectReason">
                    Reason for rejection
                  </label>
                  <textarea
                    id="rejectReason"
                    className={`rodash-textarea ${
                      reasonError ? "rodash-textarea-error" : ""
                    }`}
                    rows={4}
                    value={reason}
                    disabled={busy}
                    onChange={(event) => {
                      setReason(event.target.value);
                      if (reasonError) setReasonError(null);
                    }}
                    placeholder="e.g. The listed base location does not match the Colombo district this team registered for."
                  />
                  {reasonError && (
                    <p className="rodash-textarea-error-text">{reasonError}</p>
                  )}
                  <p className="rodash-modal-text">
                    The leader sees this reason in their dashboard and can edit
                    and resubmit the team. An email goes to{" "}
                    <strong>{decision.team.leaderEmail}</strong>.
                  </p>
                </>
              )}
            </div>

            <div className="rodash-modal-foot">
              <button
                type="button"
                className="rodash-modal-cancel"
                onClick={closeDecision}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  decision.mode === "approve"
                    ? "rodash-modal-confirm rodash-modal-confirm-approve"
                    : "rodash-modal-confirm rodash-modal-confirm-reject"
                }
                onClick={confirmDecision}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={15} className="rodash-spin" />
                ) : decision.mode === "approve" ? (
                  <Check size={15} />
                ) : (
                  <Ban size={15} />
                )}
                {busy
                  ? "Saving..."
                  : decision.mode === "approve"
                    ? "Approve team"
                    : "Reject team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrganizationView({ data }: { data: RescueOrganizationDashboard }) {
  const status = statusMeta(data.account.status);

  return (
    <section className="rodash-card">
      <div className="rodash-card-head">
        <h3>Verified organization details</h3>
        <p>Submitted by your organization representative and reviewed by a Super Admin</p>
      </div>
      <div className="rodash-detail-grid">
        <DetailBlock icon={Building2} label="Organization name" value={data.organization.name} />
        <DetailBlock icon={ShieldCheck} label="Organization type" value={data.organization.type} />
        <DetailBlock icon={BadgeCheck} label="Registration ID" value={data.organization.registrationId} />
        <DetailBlock icon={MapPin} label="District" value={data.organization.district} />
        <DetailBlock icon={Mail} label="Official email" value={data.organization.officialEmail} />
        <DetailBlock icon={Phone} label="Official phone" value={data.organization.officialPhone} />
        <DetailBlock icon={MapPin} label="Address" value={data.organization.address} wide />
      </div>
      <div className="rodash-status-strip">
        <span className={`rodash-pill rodash-pill-${status.tone}`}>
          <BadgeCheck size={13} />
          {status.label}
        </span>
        <span>
          Registered {formatDate(data.account.registeredAt)}
          {data.account.verifiedAt
            ? ` · verified ${formatDate(data.account.verifiedAt)}`
            : ""}
        </span>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: typeof Home;
  label: string;
  value: number;
  caption: string;
  tone: "blue" | "success" | "amber" | "navy" | "red";
}) {
  return (
    <div className="rodash-stat">
      <div className={`rodash-stat-icon rodash-stat-icon-${tone}`}>
        <Icon size={19} />
      </div>
      <div className="rodash-stat-value">{value}</div>
      <div className="rodash-stat-label">{label}</div>
      <div className="rodash-stat-caption">{caption}</div>
    </div>
  );
}

function ReadinessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rodash-row">
      <span className="rodash-row-label">{label}</span>
      <span className="rodash-row-value">{value}</span>
    </div>
  );
}

function DetailBlock({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rodash-detail ${wide ? "rodash-detail-wide" : ""}`}>
      <div className="rodash-detail-icon">
        <Icon size={15} />
      </div>
      <div className="rodash-detail-label">{label}</div>
      <div className="rodash-detail-value">{value}</div>
    </div>
  );
}

const CSS = `
  .rodash-app {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    background: ${Colors.background};
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: ${Colors.text};
  }

  .rodash-sidebar {
    width: 268px;
    flex-shrink: 0;
    background: ${Colors.navy};
    padding: 26px 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .rodash-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .rodash-brand-mark {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: ${Colors.blue};
    color: ${Colors.white};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .rodash-brand-name {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.white};
  }

  .rodash-brand-name span { color: ${Colors.amber}; }

  .rodash-brand-sub {
    color: ${Colors.blueLight};
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.11em;
    margin-top: 3px;
  }

  .rodash-org-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: ${Colors.blueLight};
  }

  .rodash-org-name {
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
    line-height: 1.35;
  }

  .rodash-org-meta {
    color: ${Colors.blueLight};
    font-size: 11.5px;
    margin-top: 2px;
  }

  .rodash-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .rodash-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
    transition: background 160ms ease, color 160ms ease;
  }

  .rodash-nav-item svg:last-child {
    margin-left: auto;
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .rodash-nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: ${Colors.white};
  }

  .rodash-nav-item-active {
    background: ${Colors.blue};
    color: ${Colors.white};
  }

  .rodash-nav-item-active svg:last-child { opacity: 1; }

  .rodash-sidebar-foot {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .rodash-admin {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .rodash-avatar {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: ${Colors.navyLight};
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .rodash-admin-name {
    color: ${Colors.white};
    font-size: 13px;
    font-weight: 800;
  }

  .rodash-admin-role {
    color: ${Colors.blueLight};
    font-size: 11.5px;
    margin-top: 2px;
  }

  .rodash-logout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 14px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: ${Colors.white};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 160ms ease;
  }

  .rodash-logout:hover { background: rgba(217, 45, 32, 0.85); }

  .rodash-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .rodash-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 26px clamp(20px, 3vw, 34px) 22px;
    background: ${Colors.white};
    border-bottom: 1px solid ${Colors.border};
  }

  .rodash-topbar h1 {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.navy};
    margin: 0 0 5px;
  }

  .rodash-topbar p {
    font-size: 13px;
    color: ${Colors.muted};
    margin: 0;
  }

  .rodash-refresh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
    flex-shrink: 0;
  }

  .rodash-refresh:hover {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .rodash-body {
    flex: 1;
    padding: clamp(18px, 3vw, 26px) clamp(20px, 3vw, 34px) 48px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .rodash-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 0;
    color: ${Colors.muted};
    font-size: 14px;
    font-weight: 600;
  }

  .rodash-spin { animation: rodash-turn 900ms linear infinite; }

  @keyframes rodash-turn {
    to { transform: rotate(360deg); }
  }

  .rodash-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 16px;
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
  }

  .rodash-error h3 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 800;
  }

  .rodash-error p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.6;
  }

  .rodash-error-action {
    margin-left: auto;
    align-self: center;
    padding: 9px 14px;
    border: 1px solid ${Colors.red};
    border-radius: 10px;
    background: ${Colors.white};
    color: ${Colors.redDark};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .rodash-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding: clamp(22px, 3vw, 28px);
    border-radius: 20px;
    background: linear-gradient(135deg, ${Colors.navy} 0%, ${Colors.navyLight} 100%);
    box-shadow: 0 16px 40px rgba(11, 31, 51, 0.18);
  }

  .rodash-hero-text { min-width: 0; }

  .rodash-hero h2 {
    font-size: clamp(20px, 2.6vw, 26px);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${Colors.white};
    margin: 14px 0 8px;
  }

  .rodash-hero p {
    font-size: 13.5px;
    line-height: 1.65;
    color: ${Colors.blueLight};
    margin: 0;
    max-width: 620px;
  }

  .rodash-hero p strong { color: ${Colors.white}; }

  .rodash-hero-facts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }

  .rodash-fact {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: ${Colors.white};
    font-size: 12px;
    font-weight: 700;
  }

  .rodash-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .rodash-pill-success { background: rgba(18, 183, 106, 0.16); color: #067647; }
  .rodash-pill-warning { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .rodash-pill-danger { background: ${Colors.redLight}; color: ${Colors.redDark}; }
  .rodash-pill-neutral { background: ${Colors.background}; color: ${Colors.muted}; }

  .rodash-hero .rodash-pill-success {
    background: rgba(18, 183, 106, 0.22);
    color: #7EE2B8;
  }

  .rodash-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px;
  }

  .rodash-stat {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.06);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .rodash-stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 34px rgba(11, 31, 51, 0.1);
  }

  .rodash-stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .rodash-stat-icon-blue { background: ${Colors.blueLight}; color: ${Colors.blue}; }
  .rodash-stat-icon-success { background: rgba(18, 183, 106, 0.14); color: ${Colors.success}; }
  .rodash-stat-icon-amber { background: ${Colors.amberLight}; color: ${Colors.amber}; }
  .rodash-stat-icon-navy { background: rgba(11, 31, 51, 0.09); color: ${Colors.navy}; }

  .rodash-stat-icon-red { background: ${Colors.redLight}; color: ${Colors.redDark}; }

  .rodash-stat-value {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: ${Colors.navy};
    line-height: 1.1;
  }

  .rodash-stat-label {
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.navy};
    margin-top: 6px;
  }

  .rodash-stat-caption {
    font-size: 11.5px;
    color: ${Colors.muted};
    margin-top: 4px;
    line-height: 1.5;
  }

  .rodash-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }

  .rodash-disasters {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rodash-disaster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
    gap: 14px;
  }

  .rodash-disaster-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.background};
    color: ${Colors.navy};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }

  .rodash-disaster-card:hover {
    transform: translateY(-2px);
    border-color: ${Colors.blue};
    background: ${Colors.white};
  }

  .rodash-disaster-card:hover .rodash-disaster-arrow {
    transform: translateX(3px);
    color: ${Colors.blue};
  }

  .rodash-disaster-card-all {
    border-style: dashed;
  }

  .rodash-disaster-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.blue};
  }

  .rodash-disaster-card:hover .rodash-disaster-icon {
    background: rgba(21, 112, 239, 0.1);
    border-color: transparent;
  }

  .rodash-disaster-body {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    flex: 1;
  }

  .rodash-disaster-body h4 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 800;
  }

  .rodash-disaster-body p {
    margin: 0;
    color: ${Colors.muted};
    font-size: 12.5px;
    font-weight: 600;
  }

  .rodash-disaster-body .rodash-pill {
    align-self: flex-start;
    margin-top: 3px;
  }

  .rodash-disaster-arrow {
    flex-shrink: 0;
    color: ${Colors.muted};
    transition: transform 180ms ease, color 180ms ease;
  }

  .rodash-card {
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-radius: 20px;
    padding: clamp(20px, 2.6vw, 26px);
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.06);
  }

  .rodash-card-head {
    padding-bottom: 16px;
    margin-bottom: 6px;
    border-bottom: 1px solid ${Colors.background};
  }

  .rodash-card-head h3 {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
    margin: 0 0 5px;
  }

  .rodash-card-head p {
    font-size: 12.5px;
    color: ${Colors.muted};
    margin: 0;
    line-height: 1.55;
  }

  .rodash-rows { padding-top: 6px; }

  .rodash-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 0;
    border-bottom: 1px solid ${Colors.background};
  }

  .rodash-row:last-child { border-bottom: none; }

  .rodash-row-label {
    font-size: 12.5px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .rodash-row-value {
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.navy};
    text-align: right;
    word-break: break-word;
  }

  .rodash-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-radius: 14px;
    background: rgba(18, 183, 106, 0.12);
    border: 1px solid ${Colors.success};
    color: #067647;
    font-size: 13px;
    font-weight: 700;
  }

  .rodash-review-callout {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 18px;
    background: ${Colors.amberLight};
    border: 1px solid ${Colors.amber};
    color: ${Colors.amberText};
  }

  .rodash-review-callout strong {
    display: block;
    font-size: 13.5px;
    font-weight: 800;
  }

  .rodash-review-callout p {
    margin: 5px 0 0;
    font-size: 12.5px;
    line-height: 1.6;
  }

  .rodash-filter-panel {
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 16px 18px;
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.white};
    box-shadow: 0 8px 22px rgba(11, 31, 51, 0.05);
  }

  .rodash-filter-block {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .rodash-ghost {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 13px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }

  .rodash-ghost:hover {
    border-color: ${Colors.red};
    color: ${Colors.red};
  }

  .rodash-filter-caption {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${Colors.muted};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rodash-filter-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 15px;
    border: 1px dashed ${Colors.border};
    border-radius: 12px;
    background: ${Colors.background};
  }

  .rodash-filter-summary p {
    margin: 0;
    color: ${Colors.muted};
    font-size: 12.5px;
    font-weight: 600;
  }

  .rodash-filter-summary strong {
    color: ${Colors.navy};
    font-weight: 800;
  }

  .rodash-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rodash-filter {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }

  .rodash-filter span {
    min-width: 20px;
    padding: 2px 6px;
    border-radius: 999px;
    background: ${Colors.background};
    font-size: 11px;
    text-align: center;
  }

  .rodash-filter svg {
    flex-shrink: 0;
  }

  .rodash-filter:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .rodash-filter-active {
    background: ${Colors.navy};
    border-color: ${Colors.navy};
    color: ${Colors.white};
  }

  .rodash-filter-active span {
    background: rgba(255, 255, 255, 0.18);
    color: ${Colors.white};
  }

  .rodash-team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 18px;
  }

  .rodash-team-card {
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 20px;
    border-radius: 18px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    border-top: 3px solid ${Colors.border};
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.06);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .rodash-team-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 34px rgba(11, 31, 51, 0.1);
  }

  .rodash-team-card-warning { border-top-color: ${Colors.amber}; }
  .rodash-team-card-success { border-top-color: ${Colors.success}; }
  .rodash-team-card-danger { border-top-color: ${Colors.red}; }

  .rodash-team-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .rodash-team-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 13px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rodash-team-heading { min-width: 0; flex: 1; }

  .rodash-team-heading h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
    line-height: 1.4;
    word-break: break-word;
  }

  .rodash-team-heading p {
    margin: 4px 0 0;
    font-size: 12px;
    color: ${Colors.muted};
  }

  .rodash-team-leader {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 14px;
    border-radius: 14px;
    background: ${Colors.background};
    color: ${Colors.muted};
  }

  .rodash-team-leader-name {
    font-size: 13px;
    font-weight: 800;
    color: ${Colors.navy};
  }

  .rodash-team-leader-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 3px;
    font-size: 11.5px;
    color: ${Colors.muted};
  }

  .rodash-team-facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }

  .rodash-team-fact {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 11px;
    border-radius: 11px;
    border: 1px solid ${Colors.background};
    background: rgba(245, 247, 250, 0.7);
    font-size: 11.5px;
    font-weight: 700;
    color: ${Colors.text};
  }

  .rodash-team-fact svg { color: ${Colors.blue}; flex-shrink: 0; }

  .rodash-team-skills {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
  }

  .rodash-team-skill-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .rodash-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .rodash-chip {
    padding: 5px 10px;
    border-radius: 999px;
    background: ${Colors.blueLight};
    color: ${Colors.blueDark};
    font-size: 11.5px;
    font-weight: 700;
  }

  .rodash-chip-empty {
    font-size: 11.5px;
    color: ${Colors.muted};
  }

  .rodash-team-base {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    color: ${Colors.muted};
    line-height: 1.55;
  }

  .rodash-team-base svg { color: ${Colors.blue}; flex-shrink: 0; margin-top: 2px; }

  .rodash-team-approved,
  .rodash-team-rejected {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 13px;
    font-size: 12px;
    line-height: 1.6;
  }

  .rodash-team-approved {
    background: rgba(18, 183, 106, 0.1);
    border: 1px solid rgba(18, 183, 106, 0.35);
    color: #067647;
  }

  .rodash-team-rejected {
    background: ${Colors.redLight};
    border: 1px solid ${Colors.red};
    color: ${Colors.redDark};
  }

  .rodash-team-actions {
    display: flex;
    gap: 10px;
    margin-top: auto;
    padding-top: 4px;
  }

  .rodash-approve,
  .rodash-reject {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 16px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
    transition: filter 160ms ease, background 160ms ease;
  }

  .rodash-approve {
    flex: 1;
    border: none;
    background: ${Colors.success};
    color: ${Colors.white};
    box-shadow: 0 10px 24px rgba(18, 183, 106, 0.24);
  }

  .rodash-approve:hover { filter: brightness(0.96); }

  .rodash-reject {
    border: 1px solid ${Colors.red};
    background: ${Colors.white};
    color: ${Colors.redDark};
  }

  .rodash-reject:hover { background: ${Colors.redLight}; }

  .rodash-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(11, 31, 51, 0.55);
    backdrop-filter: blur(3px);
  }

  .rodash-modal {
    width: min(560px, 100%);
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 20px;
    background: ${Colors.white};
    box-shadow: 0 30px 70px rgba(11, 31, 51, 0.35);
  }

  .rodash-modal-head {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 22px 22px 0;
  }

  .rodash-modal-head h3 {
    margin: 0;
    font-size: 16.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
  }

  .rodash-modal-head p {
    margin: 4px 0 0;
    font-size: 12px;
    color: ${Colors.muted};
  }

  .rodash-modal-icon {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rodash-modal-icon-approve {
    background: rgba(18, 183, 106, 0.14);
    color: ${Colors.success};
  }

  .rodash-modal-icon-reject {
    background: ${Colors.redLight};
    color: ${Colors.redDark};
  }

  .rodash-modal-close {
    margin-left: auto;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
    background: ${Colors.white};
    color: ${Colors.muted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .rodash-modal-body { padding: 18px 22px 4px; }

  .rodash-modal-text {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.7;
    color: ${Colors.muted};
  }

  .rodash-modal-text strong { color: ${Colors.navy}; }

  .rodash-modal-label {
    display: block;
    margin-bottom: 8px;
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${Colors.navy};
  }

  .rodash-textarea {
    width: 100%;
    padding: 13px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 13px;
    background: ${Colors.background};
    font-family: inherit;
    font-size: 13px;
    line-height: 1.6;
    color: ${Colors.text};
    resize: vertical;
  }

  .rodash-textarea:focus {
    outline: none;
    border-color: ${Colors.blue};
    background: ${Colors.white};
    box-shadow: 0 0 0 4px ${Colors.blueLight};
  }

  .rodash-textarea-error { border-color: ${Colors.red}; }

  .rodash-textarea-error-text {
    margin: 8px 0 12px;
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.redDark};
  }

  .rodash-modal-foot {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 20px 22px 22px;
  }

  .rodash-modal-cancel {
    padding: 11px 18px;
    border: 1px solid ${Colors.border};
    border-radius: 12px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .rodash-modal-confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 20px;
    border: none;
    border-radius: 12px;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .rodash-modal-confirm-approve {
    background: ${Colors.success};
    color: ${Colors.white};
    box-shadow: 0 10px 24px rgba(18, 183, 106, 0.26);
  }

  .rodash-modal-confirm-reject {
    background: ${Colors.red};
    color: ${Colors.white};
    box-shadow: 0 10px 24px rgba(217, 45, 32, 0.24);
  }

  .rodash-modal-confirm:disabled,
  .rodash-modal-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .rodash-table-wrap { overflow-x: auto; }

  .rodash-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 640px;
  }

  .rodash-table th {
    text-align: left;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${Colors.muted};
    padding: 12px 14px;
    background: ${Colors.background};
  }

  .rodash-table td {
    padding: 15px 14px;
    font-size: 13px;
    color: ${Colors.text};
    border-bottom: 1px solid ${Colors.background};
    vertical-align: middle;
  }

  .rodash-table tbody tr:hover td { background: rgba(21, 112, 239, 0.03); }

  .rodash-team-name { font-weight: 800; color: ${Colors.navy}; }

  .rodash-team-sub {
    font-size: 11.5px;
    color: ${Colors.muted};
    margin-top: 3px;
  }

  .rodash-detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 14px;
    padding-top: 16px;
  }

  .rodash-detail {
    padding: 16px;
    border-radius: 14px;
    border: 1px solid ${Colors.background};
    background: ${Colors.background};
  }

  .rodash-detail-wide { grid-column: 1 / -1; }

  .rodash-detail-icon {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
  }

  .rodash-detail-label {
    font-size: 11.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .rodash-detail-value {
    font-size: 14px;
    font-weight: 800;
    color: ${Colors.navy};
    margin-top: 6px;
    line-height: 1.5;
    word-break: break-word;
  }

  .rodash-status-strip {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid ${Colors.background};
    font-size: 12.5px;
    color: ${Colors.muted};
  }

  .rodash-empty { text-align: center; padding: 48px 24px; }

  .rodash-empty-icon {
    width: 62px;
    height: 62px;
    margin: 0 auto 16px;
    border-radius: 20px;
    background: ${Colors.blueLight};
    color: ${Colors.blue};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rodash-empty h3 {
    font-size: 17px;
    font-weight: 800;
    color: ${Colors.navy};
    margin: 0 0 8px;
  }

  .rodash-empty p {
    font-size: 13px;
    color: ${Colors.muted};
    line-height: 1.65;
    margin: 0 auto;
    max-width: 460px;
  }

  .rodash-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 18px;
    padding: 11px 18px;
    border: none;
    border-radius: 12px;
    background: ${Colors.blue};
    color: ${Colors.white};
    font-family: inherit;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(21, 112, 239, 0.26);
  }

  @media (max-width: 1024px) {
    .rodash-app { flex-direction: column; }
    .rodash-sidebar { width: 100%; min-width: 0; flex-shrink: 1; padding: 20px; }
    .rodash-nav { flex-direction: row; flex-wrap: wrap; overflow-x: visible; }
    .rodash-nav-item { white-space: nowrap; }
    .rodash-nav-item svg:last-child { display: none; }
    .rodash-sidebar-foot { flex-direction: row; align-items: center; justify-content: space-between; }
  }

  @media (max-width: 640px) {
    .rodash-hero-facts { width: 100%; }
    .rodash-topbar { padding: 20px; }
    .rodash-stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
  }
`;
