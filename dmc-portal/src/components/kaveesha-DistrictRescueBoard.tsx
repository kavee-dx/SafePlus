import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Compass,
  Gauge,
  Globe,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Colors } from "../constants/theme";
import {
  CAPABILITY_ICONS,
  EQUIPMENT_ICONS,
  teamTypeIcon,
} from "../constants/kaveesha-rescueTeamOptions";
import {
  fetchDistrictRescueBoard,
  type BoardScope,
  type DistrictRescueBoard,
  type DistrictTeamCard,
} from "../services/kaveesha-districtTeamsApi";

interface DistrictRescueBoardProps {
  token: string | null;
  /** District the officer is assigned to, used to label the scope switch. */
  homeDistrict: string;
}

const TEAM_PREVIEW_LIMIT = 6;

const AVAILABILITY_TONES: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: "Available", tone: "success" },
  ON_DEPLOYMENT: { label: "On deployment", tone: "warning" },
  UNAVAILABLE: { label: "Standing down", tone: "neutral" },
};

function availabilityMeta(value: string) {
  return AVAILABILITY_TONES[value] ?? { label: value, tone: "neutral" };
}

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Rescue force board for District Officers.
 *
 * The officer's own district is the default scope because that is the force
 * they can task immediately; mutual aid is one switch away and every borrowed
 * team is labelled as coming from outside the district.
 */
export default function KaveeshaDistrictRescueBoard({
  token,
  homeDistrict,
}: DistrictRescueBoardProps) {
  // An officer without an assigned district (a DMC duty officer, for example)
  // is already looking at every district, so the board opens on that scope.
  const [scope, setScope] = useState<BoardScope>(
    homeDistrict.trim() ? "district" : "all"
  );
  const [data, setData] = useState<DistrictRescueBoard | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [disaster, setDisaster] = useState("all");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showAllGroups, setShowAllGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    fetchDistrictRescueBoard(token, scope)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setDisaster("all");
        setLoading(false);
      })
      .catch((cause: Error) => {
        if (cancelled) return;
        setError(cause.message || "The rescue board could not be loaded.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, scope, reload]);

  /** Loading is raised by the action that starts the request, not the effect. */
  const switchScope = (next: BoardScope) => {
    if (next === scope) return;
    setLoading(true);
    setError(null);
    setScope(next);
  };

  const refreshBoard = () => {
    setLoading(true);
    setError(null);
    setReload((key) => key + 1);
  };

  const matchesQuery = useCallback((team: DistrictTeamCard, needle: string) => {
    if (!needle) return true;

    return [
      team.teamName,
      team.teamType,
      team.district,
      team.organization?.name ?? "",
      team.leader.fullName,
      team.leader.designation ?? "",
      team.contactNumber,
      team.base.label ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  }, []);

  const needle = query.trim().toLowerCase();

  /** Search narrows everything; the disaster tab narrows the roster view. */
  const searched = useMemo(
    () => (data?.teams ?? []).filter((team) => matchesQuery(team, needle)),
    [data, needle, matchesQuery]
  );

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();

    searched.forEach((team) => {
      counts.set(team.teamType, (counts.get(team.teamType) ?? 0) + 1);
    });

    return [
      { key: "all", label: "All teams", count: searched.length },
      ...[...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
        .map((item) => ({ key: item.type, label: item.type, count: item.count })),
    ];
  }, [searched]);

  const groups = useMemo(() => {
    const selected =
      disaster === "all"
        ? searched
        : searched.filter((team) => team.teamType === disaster);

    const map = new Map<
      string,
      {
        key: string;
        name: string;
        registrationId: string | null;
        kind: "ORGANIZATION" | "INDEPENDENT";
        districts: string[];
        teams: DistrictTeamCard[];
      }
    >();

    selected.forEach((team) => {
      const key = team.organization
        ? `ORG:${team.organization.registrationId}`
        : `IND:${team.district}`;

      const group =
        map.get(key) ??
        {
          key,
          name: team.organization?.name ?? "Independent teams",
          registrationId: team.organization?.registrationId ?? null,
          kind: team.organization ? "ORGANIZATION" : "INDEPENDENT",
          districts: [] as string[],
          teams: [] as DistrictTeamCard[],
        };

      group.teams.push(team);

      if (!group.districts.includes(team.district)) {
        group.districts.push(team.district);
      }

      map.set(key, group);
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        available: group.teams.filter(
          (team) => team.availability === "AVAILABLE"
        ).length,
        members: group.teams.reduce((total, team) => total + team.members, 0),
      }))
      .sort(
        (a, b) =>
          b.available - a.available ||
          b.teams.length - a.teams.length ||
          a.name.localeCompare(b.name)
      );
  }, [searched, disaster]);

  /** A short roster stays open so the officer sees the force without clicking. */
  const rosterIsSmall = groups.length <= 4;

  /** Figures follow the view: they recount with the disaster tab and search. */
  const view = useMemo(() => {
    const teams = groups.flatMap((group) => group.teams);

    return {
      teams: teams.length,
      available: teams.filter((team) => team.availability === "AVAILABLE")
        .length,
      onDeployment: teams.filter((team) => team.availability === "ON_DEPLOYMENT")
        .length,
      standingDown: teams.filter((team) => team.availability === "UNAVAILABLE")
        .length,
      members: teams.reduce((total, team) => total + team.members, 0),
      districts: new Set(teams.map((team) => team.district)).size,
    };
  }, [groups]);

  const viewIsFiltered = disaster !== "all" || needle.length > 0;

  const clearViewFilters = () => {
    setDisaster("all");
    setQuery("");
  };

  const scopeLabel =
    data?.officer.scope === "mutual-aid"
      ? "all districts"
      : `${data?.officer.district || "my"} District`;

  const isGroupOpen = (key: string) => openGroups[key] ?? rosterIsSmall;

  const toggleGroup = (key: string) =>
    setOpenGroups((current) => ({
      ...current,
      [key]: !(current[key] ?? rosterIsSmall),
    }));

  if (!token) {
    return (
      <div className="dboard-error">
        <AlertTriangle size={18} />
        <div>
          <h3>Session not found</h3>
          <p>Please sign out and sign in again to load the rescue board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dboard">
      <section className="dboard-toolbar">
        <div className="dboard-scopes" role="group" aria-label="Team scope">
          <button
            type="button"
            className={`dboard-scope ${
              scope === "district" ? "dboard-scope-active" : ""
            }`}
            onClick={() => switchScope("district")}
          >
            <ShieldCheck size={15} />
            <span>
              {homeDistrict ? `${homeDistrict} District` : "My district"}
              <small>Teams I can task directly</small>
            </span>
          </button>
          <button
            type="button"
            className={`dboard-scope ${
              scope === "all" ? "dboard-scope-active" : ""
            }`}
            onClick={() => switchScope("all")}
          >
            <Globe size={15} />
            <span>
              Mutual aid · all districts
              <small>Borrow verified teams from elsewhere</small>
            </span>
          </button>
        </div>

        <div className="dboard-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team, leader, organization or base location"
            aria-label="Search rescue teams"
          />
        </div>

        <button
          type="button"
          className="dboard-refresh"
          onClick={refreshBoard}
        >
          <RefreshCw size={15} className={loading ? "dboard-spin" : ""} />
          <span>Refresh</span>
        </button>
      </section>

      {error && (
        <div className="dboard-error">
          <AlertTriangle size={18} />
          <div>
            <h3>Rescue board could not be loaded</h3>
            <p>{error}</p>
          </div>
          <button
            type="button"
            className="dboard-error-action"
            onClick={refreshBoard}
          >
            Try again
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="dboard-loading">
          <Loader2 size={22} className="dboard-spin" />
          <span>Loading approved rescue teams...</span>
        </div>
      )}

      {data && (
        <>
          <section className="dboard-stats">
            <Stat value={view.teams} label="Teams in view" icon={Users} />
            <Stat
              value={view.available}
              label="Available now"
              icon={Gauge}
              tone="success"
            />
            <Stat
              value={view.onDeployment}
              label="On deployment"
              icon={AlertTriangle}
              tone="warning"
            />
            <Stat
              value={view.standingDown}
              label="Standing down"
              icon={Users}
              tone="neutral"
            />
            <Stat
              value={view.members}
              label="Rescuers"
              icon={UserRound}
            />
            <Stat
              value={groups.length}
              label={
                view.districts > 1
                  ? `Groups · ${view.districts} districts`
                  : "Organizations"
              }
              icon={Building2}
            />
          </section>

          {data.summary.districts > 1 && (
            <div className="dboard-note">
              <Globe size={14} />
              <span>
                Mutual aid is on: teams outside{" "}
                <strong>{data.officer.district ?? "your district"}</strong> are
                flagged{" "}
                <strong>Mutual aid · outside my district</strong>. Confirm
                availability with their own district office before tasking them.
              </span>
            </div>
          )}

          <section className="dboard-tabs">
            <div className="dboard-tabs-head">
              <Layers size={13} />
              <span>Disaster response</span>
            </div>
            <div className="dboard-tab-row">
              {tabs.map((tab) => {
                const Icon =
                  tab.key === "all" ? Layers : teamTypeIcon(tab.key);

                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`dboard-tab ${
                      disaster === tab.key ? "dboard-tab-active" : ""
                    }`}
                    onClick={() => setDisaster(tab.key)}
                  >
                    <Icon size={14} />
                    {tab.label}
                    <span>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="dboard-summary">
            <p>
              Showing <strong>{view.teams}</strong> of {data.summary.teams}{" "}
              approved team{data.summary.teams === 1 ? "" : "s"} in{" "}
              <strong>{scopeLabel}</strong>
              {disaster === "all" ? "" : ` · ${disaster.toLowerCase()}`}
              {needle ? ` · matching “${query.trim()}”` : ""}
            </p>
            {viewIsFiltered && (
              <button
                type="button"
                className="dboard-ghost"
                onClick={clearViewFilters}
              >
                <X size={14} />
                Clear filters
              </button>
            )}
          </div>

          {!loading && groups.length === 0 && (
            <div className="dboard-empty">
              <Search size={24} />
              <h3>No teams match this view</h3>
              <p>
                {query
                  ? "Try a different name, organization or base location."
                  : "No approved team is registered for this disaster in the current scope."}
              </p>
            </div>
          )}

          {groups.map((group) => {
            const open = isGroupOpen(group.key);
            const showAll = showAllGroups[group.key] ?? false;
            const visibleTeams = showAll
              ? group.teams
              : group.teams.slice(0, TEAM_PREVIEW_LIMIT);

            const GroupIcon =
              group.kind === "ORGANIZATION" ? Building2 : Compass;

            return (
              <section key={group.key} className="dboard-org">
                <button
                  type="button"
                  className="dboard-org-head"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={open}
                >
                  <div className="dboard-org-icon">
                    <GroupIcon size={17} />
                  </div>
                  <div className="dboard-org-title">
                    <h3>{group.name}</h3>
                    <p>
                      {group.kind === "ORGANIZATION"
                        ? `Registration ${group.registrationId}`
                        : "Independent teams · verified by a Super Admin"}
                      {" · "}
                      {group.districts.join(", ")}
                    </p>
                  </div>
                  <div className="dboard-org-facts">
                    <span>
                      <Users size={13} />
                      {group.teams.length} teams
                    </span>
                    <span className="dboard-org-facts-success">
                      <BadgeCheck size={13} />
                      {group.available} available
                    </span>
                    <span>
                      <UserRound size={13} />
                      {group.members} members
                    </span>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`dboard-org-chevron ${
                      open ? "dboard-org-chevron-open" : ""
                    }`}
                  />
                </button>

                {open && (
                  <div className="dboard-org-body">
                    <div className="dboard-team-grid">
                      {visibleTeams.map((team) => (
                        <TeamCard key={team.userId} team={team} />
                      ))}
                    </div>

                    {group.teams.length > TEAM_PREVIEW_LIMIT && (
                      <button
                        type="button"
                        className="dboard-more"
                        onClick={() =>
                          setShowAllGroups((current) => ({
                            ...current,
                            [group.key]: !showAll,
                          }))
                        }
                      >
                        <span>
                          {showAll
                            ? "Show fewer teams"
                            : `Show all ${group.teams.length} teams`}
                        </span>
                        <ChevronRight
                          size={14}
                          className={showAll ? "dboard-more-up" : ""}
                        />
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      <style>{BOARD_STYLES}</style>
    </div>
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

function Stat({
  value,
  label,
  icon: Icon,
  tone = "blue",
}: {
  value: number;
  label: string;
  icon: typeof Users;
  tone?: "blue" | "success" | "warning" | "neutral";
}) {
  return (
    <div className={`dboard-stat dboard-stat-${tone}`}>
      <div className="dboard-stat-icon">
        <Icon size={15} />
      </div>
      <div className="dboard-stat-value">{value}</div>
      <div className="dboard-stat-label">{label}</div>
    </div>
  );
}

function TeamCard({ team }: { team: DistrictTeamCard }) {
  const availability = availabilityMeta(team.availability);
  const hasBase = team.base.latitude !== null && team.base.longitude !== null;

  return (
    <article
      className={`dboard-team dboard-team-${availability.tone} ${
        team.outsideDistrict ? "dboard-team-outside" : ""
      }`}
    >
      <div className="dboard-team-head">
        <div className="dboard-team-icon">
          <Glyph icon={teamTypeIcon(team.teamType)} size={17} />
        </div>
        <div className="dboard-team-heading">
          <h4>{team.teamName}</h4>
          <p>
            {team.teamType} · {team.district} District
          </p>
        </div>
        <span className={`dboard-pill dboard-pill-${availability.tone}`}>
          {availability.label}
        </span>
      </div>

      {team.outsideDistrict && (
        <div className="dboard-team-outside-flag">
          <Globe size={12} />
          <span>Mutual aid · outside my district</span>
        </div>
      )}

      <div className="dboard-team-leader">
        <UserRound size={14} />
        <div>
          <div className="dboard-team-leader-name">
            {team.leader.fullName}
            {team.leader.designation ? ` · ${team.leader.designation}` : ""}
          </div>
          <div className="dboard-team-leader-contacts">
            <span>
              <Phone size={11} />
              {team.leader.phone}
            </span>
            <span>
              <Mail size={11} />
              {team.leader.email}
            </span>
          </div>
        </div>
      </div>

      <div className="dboard-team-facts">
        <span>
          <Users size={12} />
          {team.members} members
        </span>
        <span>
          <Phone size={12} />
          {team.contactNumber}
        </span>
        {team.reviewedAt && (
          <span>
            <CalendarClock size={12} />
            {team.verifiedBy} · {formatDate(team.reviewedAt)}
          </span>
        )}
      </div>

      <div className="dboard-team-chips">
        {team.capabilities.map((item) => {
          const Icon = CAPABILITY_ICONS[item] ?? ShieldCheck;

          return (
            <span key={item} className="dboard-chip">
              <Icon size={11} />
              {item}
            </span>
          );
        })}
        {team.equipment.map((item) => {
          const Icon = EQUIPMENT_ICONS[item] ?? ShieldCheck;

          return (
            <span key={item} className="dboard-chip dboard-chip-equipment">
              <Icon size={11} />
              {item}
            </span>
          );
        })}
        {team.capabilities.length === 0 && team.equipment.length === 0 && (
          <span className="dboard-chip-empty">No capabilities listed</span>
        )}
      </div>

      <div className="dboard-team-base">
        <MapPin size={13} />
        <span>
          {hasBase
            ? `${team.base.label ?? "Base location"} · ${team.base.latitude?.toFixed(
                5
              )}, ${team.base.longitude?.toFixed(5)}`
            : "No base location saved"}
        </span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BOARD_STYLES = `
  .dboard {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .dboard-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    box-shadow: 0 8px 22px rgba(11, 31, 51, 0.05);
  }

  .dboard-scopes {
    display: flex;
    flex: 1;
    min-width: 260px;
    gap: 8px;
  }

  .dboard-scope {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 11px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: ${Colors.background};
    color: ${Colors.navy};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .dboard-scope span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12.5px;
    font-weight: 800;
  }

  .dboard-scope small {
    font-size: 11px;
    font-weight: 600;
    color: ${Colors.muted};
  }

  .dboard-scope svg { flex-shrink: 0; margin-top: 2px; }

  .dboard-scope:hover { border-color: ${Colors.blue}; }

  .dboard-scope-active {
    background: ${Colors.navy};
    border-color: ${Colors.navy};
    color: ${Colors.white};
  }

  .dboard-scope-active small { color: rgba(255, 255, 255, 0.72); }

  .dboard-search {
    flex: 1;
    min-width: 220px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 14px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: ${Colors.background};
    color: ${Colors.muted};
  }

  .dboard-search input {
    flex: 1;
    padding: 12px 0;
    border: none;
    background: transparent;
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    outline: none;
  }

  .dboard-refresh {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 15px;
    border: 1px solid ${Colors.border};
    border-radius: 14px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }

  .dboard-refresh:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .dboard-spin { animation: dboard-rotate 900ms linear infinite; }

  @keyframes dboard-rotate { to { transform: rotate(360deg); } }

  .dboard-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 46px 0;
    color: ${Colors.muted};
    font-size: 13px;
    font-weight: 700;
  }

  .dboard-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border: 1px solid ${Colors.redLight};
    border-radius: 16px;
    background: ${Colors.white};
    color: ${Colors.redDark};
  }

  .dboard-error h3 { margin: 0 0 4px; font-size: 14px; font-weight: 800; }
  .dboard-error p { margin: 0; font-size: 12.5px; font-weight: 600; }

  .dboard-error-action {
    margin-left: auto;
    padding: 9px 14px;
    border: none;
    border-radius: 10px;
    background: ${Colors.red};
    color: ${Colors.white};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .dboard-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }

  .dboard-stat {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 15px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.white};
    box-shadow: 0 8px 22px rgba(11, 31, 51, 0.04);
  }

  .dboard-stat-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    margin-bottom: 6px;
    border-radius: 10px;
    background: rgba(21, 112, 239, 0.1);
    color: ${Colors.blue};
  }

  .dboard-stat-success .dboard-stat-icon { background: rgba(18, 183, 106, 0.14); color: #067647; }
  .dboard-stat-warning .dboard-stat-icon { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .dboard-stat-neutral .dboard-stat-icon { background: ${Colors.background}; color: ${Colors.muted}; }

  .dboard-stat-value { font-size: 24px; font-weight: 800; color: ${Colors.navy}; line-height: 1.1; }

  .dboard-stat-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .dboard-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 16px;
    border: 1px solid ${Colors.amberLight};
    border-radius: 14px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.55;
  }

  .dboard-note svg { flex-shrink: 0; margin-top: 2px; color: ${Colors.amber}; }
  .dboard-note strong { color: ${Colors.navy}; }

  .dboard-tabs {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 15px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
  }

  .dboard-tabs-head {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: ${Colors.muted};
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dboard-tab-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .dboard-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.background};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .dboard-tab svg { flex-shrink: 0; }

  .dboard-tab span {
    min-width: 20px;
    padding: 2px 6px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    font-size: 11px;
    text-align: center;
  }

  .dboard-tab:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .dboard-tab-active {
    background: ${Colors.navy};
    border-color: ${Colors.navy};
    color: ${Colors.white};
  }

  .dboard-tab-active span {
    background: rgba(255, 255, 255, 0.16);
    border-color: transparent;
    color: ${Colors.white};
  }

  .dboard-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 16px;
    border: 1px dashed ${Colors.border};
    border-radius: 14px;
    background: ${Colors.white};
  }

  .dboard-summary p {
    margin: 0;
    color: ${Colors.muted};
    font-size: 12.5px;
    font-weight: 600;
  }

  .dboard-summary strong {
    color: ${Colors.navy};
    font-weight: 800;
  }

  .dboard-ghost {
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

  .dboard-ghost:hover {
    border-color: ${Colors.blue};
    color: ${Colors.blue};
  }

  .dboard-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 46px 20px;
    border: 1px dashed ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    text-align: center;
    color: ${Colors.muted};
  }

  .dboard-empty h3 { margin: 0; color: ${Colors.navy}; font-size: 15px; font-weight: 800; }
  .dboard-empty p { margin: 0; font-size: 12.5px; font-weight: 600; max-width: 420px; }

  .dboard-org {
    border: 1px solid ${Colors.border};
    border-radius: 20px;
    background: ${Colors.white};
    overflow: hidden;
    box-shadow: 0 10px 26px rgba(11, 31, 51, 0.05);
  }

  .dboard-org-head {
    display: flex;
    align-items: center;
    gap: 13px;
    width: 100%;
    padding: 16px 18px;
    border: none;
    background: ${Colors.white};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .dboard-org-head:hover { background: ${Colors.background}; }

  .dboard-org-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 12px;
    background: rgba(21, 112, 239, 0.1);
    color: ${Colors.blue};
  }

  .dboard-org-title { flex: 1; min-width: 0; }

  .dboard-org-title h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: ${Colors.navy};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dboard-org-title p {
    margin: 3px 0 0;
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 600;
  }

  .dboard-org-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex-shrink: 0;
  }

  .dboard-org-facts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: 999px;
    background: ${Colors.background};
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 800;
  }

  .dboard-org-facts-success {
    background: rgba(18, 183, 106, 0.14) !important;
    color: #067647 !important;
  }

  .dboard-org-chevron {
    flex-shrink: 0;
    color: ${Colors.muted};
    transition: transform 200ms ease;
  }

  .dboard-org-chevron-open { transform: rotate(180deg); }

  .dboard-org-body {
    padding: 4px 18px 18px;
    border-top: 1px solid ${Colors.border};
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dboard-team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
    padding-top: 14px;
  }

  .dboard-team {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid ${Colors.border};
    border-left: 3px solid ${Colors.border};
    border-radius: 16px;
    background: ${Colors.background};
  }

  .dboard-team-success { border-left-color: ${Colors.success}; }
  .dboard-team-warning { border-left-color: ${Colors.amber}; }
  .dboard-team-neutral { border-left-color: ${Colors.border}; }
  .dboard-team-outside { background: ${Colors.white}; border-style: dashed; }

  .dboard-team-head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
  }

  .dboard-team-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 11px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.blue};
  }

  .dboard-team-heading { flex: 1; min-width: 0; }

  .dboard-team-heading h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: ${Colors.navy};
  }

  .dboard-team-heading p {
    margin: 3px 0 0;
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 700;
  }

  .dboard-pill {
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
  }

  .dboard-pill-success { background: rgba(18, 183, 106, 0.16); color: #067647; }
  .dboard-pill-warning { background: ${Colors.amberLight}; color: ${Colors.amberText}; }
  .dboard-pill-neutral { background: ${Colors.white}; border: 1px solid ${Colors.border}; color: ${Colors.muted}; }

  .dboard-team-outside-flag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    font-size: 11px;
    font-weight: 800;
  }

  .dboard-team-leader {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    color: ${Colors.muted};
  }

  .dboard-team-leader svg { margin-top: 2px; flex-shrink: 0; }

  .dboard-team-leader-name { color: ${Colors.navy}; font-size: 12.5px; font-weight: 800; }

  .dboard-team-leader-contacts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 3px;
    font-size: 11.5px;
    font-weight: 600;
  }

  .dboard-team-leader-contacts span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .dboard-team-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .dboard-team-facts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 999px;
    background: ${Colors.white};
    border: 1px solid ${Colors.border};
    color: ${Colors.muted};
    font-size: 11px;
    font-weight: 700;
  }

  .dboard-team-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .dboard-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border-radius: 9px;
    background: rgba(21, 112, 239, 0.09);
    color: ${Colors.blue};
    font-size: 11px;
    font-weight: 700;
  }

  .dboard-chip-equipment {
    background: rgba(11, 31, 51, 0.06);
    color: ${Colors.navy};
  }

  .dboard-chip-empty { color: ${Colors.muted}; font-size: 11px; font-weight: 700; }

  .dboard-team-base {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin-top: auto;
    padding-top: 11px;
    border-top: 1px dashed ${Colors.border};
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 600;
  }

  .dboard-team-base svg { flex-shrink: 0; margin-top: 1px; }

  .dboard-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: center;
    padding: 10px 18px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .dboard-more:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .dboard-more-up { transform: rotate(180deg); }

  @media (max-width: 720px) {
    .dboard-scopes { flex-direction: column; }
    .dboard-org-head { flex-wrap: wrap; }
    .dboard-org-facts { width: 100%; justify-content: flex-start; }
    .dboard-team-grid { grid-template-columns: 1fr; }
  }
`;
