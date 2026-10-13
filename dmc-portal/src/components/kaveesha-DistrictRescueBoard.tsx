import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Users,
  Wrench,
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
  DISASTER_KINDS,
  FORCE_COVER,
  teamsForDisaster,
} from "../constants/kaveesha-disasterKinds";
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

/* Numerals are set apart from the prose the same way the overview sets them:
   a count that lines up in a column is a count that can be compared. */
const Mono =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

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
 * How long ago a verification was signed, in the fewest words that stay true.
 * Availability is self-declared, so an officer deciding whether to reconfirm a
 * team before tasking it needs to know how old that claim is. Past a month the
 * relative wording stops meaning much, so the date is shown instead.
 *
 * `at` lets a caller fix the reference moment, which is how the roster's own
 * age is kept honest between the ticks that redraw it.
 */
function timeAgo(value: string | null, at: number = Date.now()): string {
  if (!value) return "";

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const elapsed = at - then;
  const days = Math.floor(elapsed / 86_400_000);

  if (days <= 0) {
    const hours = Math.floor(elapsed / 3_600_000);
    return hours <= 0 ? "just now" : `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return formatDate(value);
}

/** Two letters for a group's medallion, taken from its own name. */
function initials(name: string): string {
  return (
    name
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "·"
  );
}

/** Rescuer totals run into four figures; a separator keeps a column readable. */
const fmt = new Intl.NumberFormat();

/** "1 team" / "3 teams" — a count that writes its own plural. */
function plural(count: number, word: string): string {
  return `${fmt.format(count)} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * A body that fields rescue teams: one registered organization, or the teams a
 * single district runs on their own. `available` and `members` describe whatever
 * is in `teams`, so a group can be narrowed by disaster and recounted.
 */
interface TeamGroup {
  key: string;
  name: string;
  registrationId: string | null;
  kind: "ORGANIZATION" | "INDEPENDENT";
  districts: string[];
  teams: DistrictTeamCard[];
  available: number;
  members: number;
}

/** The two figures a group's header carries, derived from the teams in it. */
function facts(teams: DistrictTeamCard[]) {
  return {
    available: teams.filter((team) => team.availability === "AVAILABLE").length,
    members: teams.reduce((total, team) => total + team.members, 0),
  };
}

/** Ready first, then largest, then by name — the order a call list is worked. */
function byReadiness(a: TeamGroup, b: TeamGroup): number {
  return (
    b.available - a.available ||
    b.teams.length - a.teams.length ||
    a.name.localeCompare(b.name)
  );
}

function buildGroups(teams: DistrictTeamCard[]): TeamGroup[] {
  const map = new Map<
    string,
    Omit<TeamGroup, "available" | "members">
  >();

  teams.forEach((team) => {
    const key = team.organization
      ? `ORG:${team.organization.registrationId}`
      : `IND:${team.district}`;

    const draft =
      map.get(key) ??
      {
        key,
        name: team.organization?.name ?? "Independent teams",
        registrationId: team.organization?.registrationId ?? null,
        kind: team.organization ? ("ORGANIZATION" as const) : ("INDEPENDENT" as const),
        districts: [] as string[],
        teams: [] as DistrictTeamCard[],
      };

    draft.teams.push(team);

    if (!draft.districts.includes(team.district)) {
      draft.districts.push(team.district);
    }

    map.set(key, draft);
  });

  return [...map.values()]
    .map((draft) => ({ ...draft, ...facts(draft.teams) }))
    .sort(byReadiness);
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
  /* When the roster was last read, and a tick that keeps the sentence about it
     true. The board is a snapshot, not a stream: an officer who is about to
     phone a team leader needs to know whether "available" was stated a minute
     ago or this morning. */
  const [readAt, setReadAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /* The disaster axis the roster is being read by: "all" or a hazard code. */
  const [filter, setFilter] = useState("all");
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
        setReadAt(Date.now());
        setNow(Date.now());
        setFilter("all");
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

  useEffect(() => {
    if (!readAt) return;

    const id = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(id);
  }, [readAt]);

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

  /* Bodies that field teams, counted off the search rather than the disaster
     axis: an empty result needs to be able to say "none of these four are
     registered for floods" instead of quietly showing nothing. */
  const ledger = useMemo(() => buildGroups(searched), [searched]);

  const selectedKind =
    filter === "all"
      ? null
      : DISASTER_KINDS.find((kind) => kind.code === filter) ?? null;

  /* The chosen disaster narrows each body's roster rather than replacing the
     grouping, so the officer still sees who would have to be called. */
  const groups = useMemo(
    () =>
      selectedKind
        ? ledger
            .map((group) => {
              const teams = teamsForDisaster(group.teams, selectedKind);

              return { ...group, teams, ...facts(teams) };
            })
            .filter((group) => group.teams.length > 0)
            .sort(byReadiness)
        : ledger,
    [ledger, selectedKind]
  );

  /* Cover per disaster type a citizen can report, read off the teams the search
     left in. All thirteen are listed, the empty ones included: an officer
     choosing what to ask for should see a gap, not infer it from a missing
     tile. Every figure here is derived — nothing is written down. */
  const cover = useMemo(
    () =>
      DISASTER_KINDS.map((kind) => {
        const matched = teamsForDisaster(searched, kind);
        const orgKeys = matched
          .map((team) => team.organization?.registrationId)
          .filter((id): id is string => Boolean(id));

        return {
          kind,
          teams: matched.length,
          available: matched.filter(
            (team) => team.availability === "AVAILABLE"
          ).length,
          organizations: new Set(orgKeys).size,
          members: matched.reduce((total, team) => total + team.members, 0),
        };
      }),
    [searched]
  );

  const coveredInView = cover.filter((row) => row.teams > 0).length;

  /** A short roster stays open so the officer sees the force without clicking. */
  const rosterIsSmall = groups.length <= 4;

  /* Disasters with a team able to answer, taken from the scope rather than the
     search, because this is the force's standing ability: the headline should
     not read as zero while the officer is typing. */
  const leadCovered = useMemo(
    () =>
      DISASTER_KINDS.filter(
        (kind) => teamsForDisaster(data?.teams ?? [], kind).length > 0
      ).length,
    [data]
  );

  /** Figures follow the view: they recount with the disaster axis and search. */
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

  const viewIsFiltered = filter !== "all" || needle.length > 0;

  const clearViewFilters = () => {
    setFilter("all");
    setQuery("");
  };

  const scopeLabel =
    data?.officer.scope === "mutual-aid"
      ? "all districts"
      : `${data?.officer.district || "my"} District`;

  /* How many bodies field teams before the disaster axis narrows them, so an
     empty result can name the roster it searched instead of showing nothing. */
  const orgsInView = ledger.length;

  /* How much of the search result can move: the "all teams" tile carries the
     same strip the per-disaster tiles do, so the axis reads as one scale. */
  const readyInSearch = searched.filter(
    (team) => team.availability === "AVAILABLE"
  ).length;

  const uncoveredInView = cover.length - coveredInView;

  /* Readiness of the roster in view. The meter says: of what I am looking at,
     how much can move right now. */
  const readyRate =
    view.teams > 0 ? Math.round((view.available / view.teams) * 100) : 0;

  const shareOf = (part: number, whole: number) =>
    `${whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0}%`;

  /* The roster's own age, restated every half minute. Availability is something
     a team declares about itself, so how long ago it was declared is part of
     whether it is worth acting on. */
  const rosterAge = readAt
    ? timeAgo(new Date(readAt).toISOString(), now)
    : "";

  const isGroupOpen = (key: string) => openGroups[key] ?? rosterIsSmall;

  const toggleGroup = (key: string) =>
    setOpenGroups((current) => ({
      ...current,
      [key]: !(current[key] ?? rosterIsSmall),
    }));

  if (!token) {
    /* Nothing below can load without a session, so the board keeps its header
       and offers no controls that would only fail. */
    return (
      <div className="dboard">
        <section className="dboard-hero" aria-label="Force status">
          <div className="dboard-hero-head">
            <span className="dboard-medallion">
              <ShieldCheck size={19} />
            </span>
            <p className="dboard-hero-status">
              <span
                className="dboard-hero-live dboard-hero-live-off"
                aria-hidden="true"
              />
              Not signed in — the roster cannot be read
            </p>
          </div>
          <div className="dboard-error">
            <AlertTriangle size={18} />
            <div>
              <h3>Session not found</h3>
              <p>Please sign out and sign in again to load the rescue board.</p>
            </div>
          </div>
        </section>
        {/* The stylesheet is interpolated from the colours above, so it travels
            with the view rather than landing in the app's global CSS. */}
        <style>{BOARD_STYLES}</style>
      </div>
    );
  }

  return (
    <div className="dboard">
      {/* One band carries the page: which force is being looked at, the two
          choices that change the view, and the figures that follow from them.
          The counts are a ledger divided by hairlines rather than another row of
          boxes — the officer's own overview reads figures that way already, and
          two dialects in one product would be the mistake. */}
      <section className="dboard-hero" aria-label="Force status">
        <div className="dboard-hero-head">
          <span className="dboard-medallion">
            <ShieldCheck size={19} />
          </span>
          {/* No heading in this band: the bar above already names the page, and
              saying it twice would be two titles for one thing. What the band
              does state is how current the roster is, and who earned its place
              on it. */}
          <p className="dboard-hero-status">
            <span
              className={`dboard-hero-live${
                data ? "" : " dboard-hero-live-off"
              }`}
              aria-hidden="true"
            />
            {data ? (
              <>
                Roster read <strong>{rosterAge}</strong> · every team here was
                verified by a Super Admin or its own organization admin
              </>
            ) : (
              "Reading the verified roster…"
            )}
          </p>
          <button
            type="button"
            className="dboard-refresh"
            onClick={refreshBoard}
            title="Pull the roster again"
          >
            <RefreshCw size={14} className={loading ? "dboard-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="dboard-controls">
          <div className="dboard-scopes" role="group" aria-label="Team scope">
            <button
              type="button"
              className={`dboard-scope ${
                scope === "district" ? "dboard-scope-on" : ""
              }`}
              onClick={() => switchScope("district")}
              aria-pressed={scope === "district"}
              title="The teams of your own district, which you can task directly"
            >
              <ShieldCheck size={13} />
              <span>
                {homeDistrict ? `${homeDistrict} District` : "My district"}
              </span>
            </button>
            <button
              type="button"
              className={`dboard-scope ${
                scope === "all" ? "dboard-scope-on" : ""
              }`}
              onClick={() => switchScope("all")}
              aria-pressed={scope === "all"}
              title="Verified teams from every district, borrowed as mutual aid"
            >
              <Globe size={13} />
              <span>Mutual aid · all districts</span>
            </button>
          </div>

          <div className="dboard-search">
            <Search size={14} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team, leader, organization or base"
              aria-label="Search rescue teams"
            />
            {query && (
              <button
                type="button"
                className="dboard-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {data ? (
          <div className="dboard-hero-body">
            <div className="dboard-ready">
              <div className="dboard-ready-line">
                <span className="dboard-ready-num">{readyRate}%</span>
                <span className="dboard-ready-cap">
                  {view.teams === 0
                    ? "nothing answers this view"
                    : `of ${plural(view.teams, "team")} in view can move now`}
                </span>
              </div>

              {/* Segments are sized in calc so the gaps between them are taken
                  out of each width: a plain percentage plus a gap overflows the
                  track, which is how the first build painted past its own edge. */}
              <div
                className="dboard-meter"
                role="img"
                aria-label={`${view.available} of ${view.teams} teams available now`}
              >
                <span
                  className="dboard-seg-available"
                  style={{
                    width: `calc(${shareOf(view.available, view.teams)} - 2px)`,
                  }}
                />
                <span
                  className="dboard-seg-deployed"
                  style={{
                    width: `calc(${shareOf(view.onDeployment, view.teams)} - 2px)`,
                  }}
                />
                <span
                  className="dboard-seg-resting"
                  style={{
                    width: `calc(${shareOf(view.standingDown, view.teams)} - 2px)`,
                  }}
                />
              </div>

              <div className="dboard-legend">
                <span>
                  <i className="dboard-dot-available" />
                  {fmt.format(view.available)} available
                </span>
                <span>
                  <i className="dboard-dot-deployed" />
                  {fmt.format(view.onDeployment)} on deployment
                </span>
                <span>
                  <i className="dboard-dot-resting" />
                  {fmt.format(view.standingDown)} standing down
                </span>
              </div>
            </div>

            <div className="dboard-rail">
              <RailCell
                figure={view.teams}
                caption={view.teams === 1 ? "Team in view" : "Teams in view"}
                sub={`of ${fmt.format(data.summary.teams)} verified`}
              />
              <RailCell
                figure={view.members}
                caption="Rescuers"
                sub={`of ${fmt.format(data.summary.members)} reported`}
              />
              <RailCell
                figure={groups.length}
                caption="Organizations"
                sub={`of ${fmt.format(
                  data.summary.organizations
                )} ${scope === "all" ? "across the island" : "in this district"}`}
              />
              <RailCell
                figure={leadCovered}
                caption="Disasters covered"
                sub={`${DISASTER_KINDS.length - leadCovered} with no team`}
                tone={
                  leadCovered < DISASTER_KINDS.length ? "gap" : "plain"
                }
              />
              {view.districts > 1 && (
                <RailCell
                  figure={view.districts}
                  caption="Districts"
                  sub="mutual aid is on"
                />
              )}
            </div>
          </div>
        ) : (
          /* The band is built before the numbers exist: placeholder bars where
             the meter and the ledger will land, so nothing jumps when the
             roster arrives. */
          <div className="dboard-skeleton" aria-hidden="true">
            <div className="dboard-skeleton-ready">
              <span className="dboard-skeleton-lg" />
              <span className="dboard-skeleton-bar" />
              <span className="dboard-skeleton-sm" />
            </div>
            <div className="dboard-skeleton-rail">
              {[0, 1, 2, 3].map((key) => (
                <span key={key} className="dboard-skeleton-cell">
                  <i />
                  <em />
                </span>
              ))}
            </div>
          </div>
        )}
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
        <div className="dboard-fetching">
          <Loader2 size={16} className="dboard-spin" />
          <span>Refreshing the roster…</span>
        </div>
      )}

      {data && (
        <>
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

          {/* The disaster axis sits above the roster because it is the question
              the officer starts from: a flood report is in front of them and
              they need to know whether anyone can answer it. All thirteen types
              citizens can report are shown, covered or not — the empty tiles are
              the finding, so they keep their place instead of disappearing on the
              districts that have no cover for them. */}
          <section className="dboard-cover">
            <div className="dboard-cover-head">
              <span className="dboard-axis">
                <SlidersHorizontal size={13} />
                Answer the report
              </span>
              <span className="dboard-axis-count">
                {coveredInView} of {cover.length} disaster types have a team
              </span>
              {viewIsFiltered && (
                <button
                  type="button"
                  className="dboard-clear"
                  onClick={clearViewFilters}
                >
                  <X size={12} />
                  Clear {needle ? "search and axis" : "axis"}
                </button>
              )}
            </div>

            <div className="dboard-cover-grid">
              <button
                type="button"
                className={`dboard-disaster dboard-disaster-all ${
                  filter === "all" ? "dboard-disaster-on" : ""
                }`}
                onClick={() => setFilter("all")}
                aria-pressed={filter === "all"}
                title={`Every team left by the search: ${readyInSearch} available`}
              >
                <span className="dboard-dis-top">
                  <span className="dboard-dis-ico">
                    <Users size={13} />
                  </span>
                  <span className="dboard-dis-name">All teams</span>
                  <span className="dboard-dis-num">
                    {fmt.format(searched.length)}
                  </span>
                </span>
                <span className="dboard-dis-bar">
                  <i style={{ width: shareOf(readyInSearch, searched.length) }} />
                </span>
                <span className="dboard-dis-foot">
                  {needle
                    ? `matching “${query.trim()}”`
                    : `${readyInSearch} of ${fmt.format(
                        searched.length
                      )} ready`}
                </span>
              </button>

              {cover.map(
                ({ kind, teams, available, organizations, members }) => {
                  const Icon = kind.icon;
                  const on = filter === kind.code;
                  const readyShare =
                    teams > 0 ? Math.round((available / teams) * 100) : 0;

                  return (
                    <button
                      key={kind.code}
                      type="button"
                      className={`dboard-disaster ${
                        on ? "dboard-disaster-on" : ""
                      } ${teams === 0 ? "dboard-disaster-none" : ""}`}
                      onClick={() => setFilter(on ? "all" : kind.code)}
                      aria-pressed={on}
                      title={
                        teams > 0
                          ? `${available} of ${plural(
                              teams,
                              "team"
                            )} ready · ${plural(
                              organizations,
                              "organization"
                            )} · ${fmt.format(members)} rescuers`
                          : `No team in this scope is registered for ${kind.label}`
                      }
                    >
                      <span className="dboard-dis-top">
                        <span className="dboard-dis-ico">
                          <Icon size={13} />
                        </span>
                        <span className="dboard-dis-name">{kind.label}</span>
                        <span className="dboard-dis-num">{teams}</span>
                      </span>

                      {/* A covered disaster draws how much of its force is idle
                          and ready; an uncovered one draws a rule of nothing, so
                          the gap is seen in the same shape as the cover. */}
                      {teams > 0 ? (
                        <span className="dboard-dis-bar">
                          <i style={{ width: `${readyShare}%` }} />
                        </span>
                      ) : (
                        <span className="dboard-dis-bar dboard-dis-bar-none" />
                      )}

                      <span className="dboard-dis-foot">
                        {teams > 0
                          ? `${available} ready · ${plural(
                              organizations,
                              "org"
                            )}`
                          : "No team registered"}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            {uncoveredInView > 0 && (
              <p className="dboard-gap-note">
                <AlertTriangle size={13} />
                <span>
                  <strong>
                    {uncoveredInView === 1
                      ? "One disaster type has no team able to answer it"
                      : `${uncoveredInView} disaster types have no team able to answer them`}
                  </strong>{" "}
                  {needle
                    ? `while “${query.trim()}” narrows the roster. Clear the search to see what is fielded.`
                    : scope === "district"
                    ? `in ${
                        homeDistrict || "this"
                      } District. Mutual aid will show what another district could lend.`
                    : "in any district. A report of that kind would have to be answered by the services beside the rescue teams."}
                </span>
              </p>
            )}
          </section>

          {/* One line saying what the roster below actually is, set as a heading
              with a hairline under it rather than another bordered box. */}
          <div className="dboard-roster-head">
            <h3>
              {selectedKind ? `Who answers ${selectedKind.label}` : "The roster"}
            </h3>
            <p>
              <strong>{fmt.format(view.teams)}</strong> of{" "}
              {fmt.format(data.summary.teams)} verified teams in{" "}
              <strong>{scopeLabel}</strong>
              {needle ? `, matching “${query.trim()}”` : ""} ·{" "}
              {plural(view.members, "rescuer")}
            </p>
          </div>

          {!loading && groups.length === 0 && (
            <div className="dboard-empty">
              <span className="dboard-empty-ico">
                {selectedKind ? (
                  <Glyph icon={selectedKind.icon} size={19} />
                ) : (
                  <Search size={19} />
                )}
              </span>
              <h3>
                {needle && selectedKind
                  ? `No team matching “${query.trim()}” answers ${selectedKind.label}`
                  : needle
                  ? "No team matches that search"
                  : selectedKind
                  ? `No team is registered for ${selectedKind.label}`
                  : "This scope holds no verified teams"}
              </h3>
              <p>
                {orgsInView > 0
                  ? `Searched ${plural(orgsInView, "organization")} and ${fmt.format(
                      searched.length
                    )} teams. `
                  : "There was no roster to search in this scope. "}
                {scope === "district"
                  ? "Mutual aid will show the teams other districts field."
                  : "A team reaches this board once its own organization admin or a Super Admin verifies it."}
              </p>
              {viewIsFiltered && (
                <button
                  type="button"
                  className="dboard-ghost"
                  onClick={clearViewFilters}
                >
                  <X size={13} />
                  Clear the filters
                </button>
              )}
            </div>
          )}

          {groups.map((group) => {
            const open = isGroupOpen(group.key);
            const showAll = showAllGroups[group.key] ?? false;
            const visibleTeams = showAll
              ? group.teams
              : group.teams.slice(0, TEAM_PREVIEW_LIMIT);

            /* Which disciplines the body actually fields, so a large
               organization can be judged before it is opened. */
            const disciplines = [
              ...new Set(group.teams.map((team) => team.teamType)),
            ];

            return (
              <section
                key={group.key}
                className={`dboard-org ${open ? "dboard-org-open" : ""}`}
              >
                <button
                  type="button"
                  className="dboard-org-head"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={open}
                >
                  {/* Initials rather than a generic building glyph: a shared
                      icon would say nothing about which body this is, and a
                      logo is only something organizations could offer, not
                      something the system holds. */}
                  <span
                    className={`dboard-org-mark ${
                      group.kind === "INDEPENDENT" ? "dboard-org-mark-ind" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {initials(group.name)}
                  </span>
                  <div className="dboard-org-title">
                    <h3>{group.name}</h3>
                    <p>
                      {group.kind === "ORGANIZATION"
                        ? `Registration ${group.registrationId}`
                        : "Independent teams · verified by a Super Admin"}
                      {" · "}
                      {group.districts.join(", ")}
                    </p>
                    <span className="dboard-org-disc">
                      {disciplines.slice(0, 3).map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                      {disciplines.length > 3 && (
                        <span>+{disciplines.length - 3} more</span>
                      )}
                    </span>
                  </div>
                  <div className="dboard-org-facts">
                    <span>
                      <Users size={12} />
                      {plural(group.teams.length, "team")}
                    </span>
                    <span className="dboard-org-facts-ready">
                      <BadgeCheck size={12} />
                      {group.available} ready
                    </span>
                    <span>
                      <UserRound size={12} />
                      {fmt.format(group.members)} rescuers
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
                            : `Show all ${plural(group.teams.length, "team")}`}
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

      {/* The stylesheet is interpolated from the colours above, so it travels
          with the view rather than landing in the app's global CSS. */}
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

/**
 * One figure of the roster's ledger. Deliberately not a box with an icon tile:
 * the officer reads these six numbers against each other, so they share a
 * baseline and a hairline rather than competing as separate cards.
 */
function RailCell({
  figure,
  caption,
  sub,
  tone = "plain",
}: {
  figure: number;
  caption: string;
  sub?: string;
  tone?: "plain" | "gap";
}) {
  return (
    <div
      className={`dboard-cell ${tone === "gap" ? "dboard-cell-gap" : ""}`}
    >
      <span className="dboard-cell-figure">{fmt.format(figure)}</span>
      <span className="dboard-cell-caption">{caption}</span>
      {sub && <span className="dboard-cell-sub">{sub}</span>}
    </div>
  );
}

/**
 * One verified team, written as a dispatch card: what it is, how ready it is,
 * who to call and what they bring. The three figures that decide whether to
 * task the team at all sit in a row of their own, because that is the order the
 * decision is made in.
 */
function TeamCard({ team }: { team: DistrictTeamCard }) {
  const availability = availabilityMeta(team.availability);
  const hasBase = team.base.latitude !== null && team.base.longitude !== null;
  const Icon = teamTypeIcon(team.teamType);

  return (
    <article
      className={`dboard-team dboard-team-${availability.tone} ${
        team.outsideDistrict ? "dboard-team-outside" : ""
      }`}
    >
      <header className="dboard-team-head">
        <span className="dboard-team-mark">
          <Glyph icon={Icon} size={16} />
        </span>
        <div className="dboard-team-heading">
          <h4>{team.teamName}</h4>
          <p>
            {team.teamType} · {team.district} District
          </p>
        </div>
        <span className={`dboard-pill dboard-pill-${availability.tone}`}>
          <i className="dboard-pill-dot" />
          {availability.label}
        </span>
      </header>

      {team.outsideDistrict && (
        <p className="dboard-team-outside-flag">
          <Globe size={12} />
          Mutual aid · outside my district
        </p>
      )}

      {/* Readiness and age, side by side: a team that is standing down, or whose
          availability was last stated weeks ago, is a different call to make. */}
      <dl className="dboard-team-facts">
        <div>
          <dt>Rescuers</dt>
          <dd>{fmt.format(team.members)}</dd>
        </div>
        <div>
          <dt>Verified</dt>
          <dd
            title={
              team.reviewedAt
                ? `${team.verifiedBy ?? "Verified"} · ${formatDate(
                    team.reviewedAt
                  )}`
                : undefined
            }
          >
            {team.reviewedAt ? timeAgo(team.reviewedAt) : "not dated"}
          </dd>
        </div>
        <div>
          <dt>Base</dt>
          <dd title={hasBase ? `${team.base.latitude?.toFixed(5)}, ${team.base.longitude?.toFixed(5)}` : undefined}>
            {team.base.label ?? (hasBase ? "Mapped location" : "Not set")}
          </dd>
        </div>
      </dl>

      {/* Who to call, in a field of its own. The number a dispatch desk needs
          should not have to be hunted for, so it is labelled, boxed and set with
          the leader rather than running into the card. */}
      <div className="dboard-team-block dboard-team-block-lead">
        <span className="dboard-micro">Team leader</span>
        <div className="dboard-team-leader">
          <span className="dboard-team-avatar" aria-hidden="true">
            {initials(team.leader.fullName)}
          </span>
          <div className="dboard-team-leader-body">
            <strong>
              {team.leader.fullName}
              {team.leader.designation ? ` · ${team.leader.designation}` : ""}
            </strong>
            <div className="dboard-team-contacts">
              <a href={`tel:${team.leader.phone}`}>
                <Phone size={12} />
                {team.leader.phone}
              </a>
              <a href={`mailto:${team.leader.email}`}>
                <Mail size={12} />
                {team.leader.email}
              </a>
              {/* The operations line only earns its place when it is a different
                  number than the leader's own. */}
              {team.contactNumber !== team.leader.phone && (
                <a href={`tel:${team.contactNumber}`} title="Team operations line">
                  <Phone size={12} />
                  {team.contactNumber}
                  <small>ops</small>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dboard-team-block">
        <span className="dboard-micro">Trained for</span>
        <div className="dboard-team-chips">
          {team.capabilities.map((item) => {
            const CapIcon = CAPABILITY_ICONS[item] ?? ShieldCheck;

            return (
              <span key={item} className="dboard-chip dboard-chip-cap">
                <CapIcon size={11} />
                {item}
              </span>
            );
          })}
          {team.capabilities.length === 0 && (
            <span className="dboard-chip-none">No capabilities recorded</span>
          )}
        </div>
      </div>

      {/* Kit is what the team says it brings, not something the system can
          check. It is still shown in full rather than folded away: an officer
          weighing two teams decides on the strength of that list, and a list
          behind a click cannot be compared at a glance. */}
      <div className="dboard-team-block dboard-team-block-gear">
        <span className="dboard-micro">
          <Wrench size={10} />
          {plural(team.equipment.length, "equipment item")}
        </span>
        <div className="dboard-team-chips">
          {team.equipment.map((item) => {
            const GearIcon = EQUIPMENT_ICONS[item] ?? ShieldCheck;

            return (
              <span key={item} className="dboard-chip dboard-chip-gear">
                <GearIcon size={11} />
                {item}
              </span>
            );
          })}
          {team.equipment.length === 0 && (
            <span className="dboard-chip-none">No equipment recorded</span>
          )}
        </div>
      </div>

      {/* The base itself is the third figure above; only the exact coordinates
          are repeated down here, because they are the thing that gets copied
          into a dispatch note. */}
      {hasBase && (
        <footer className="dboard-team-base">
          <MapPin size={12} />
          <span className="dboard-micro">Exact location</span>
          <span className="dboard-team-coords">
            {team.base.latitude?.toFixed(5)}, {team.base.longitude?.toFixed(5)}
          </span>
        </footer>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BOARD_STYLES = `
  /* The page is a field of white panels on the app's own grey, separated by
     hairlines rather than boxed apart: one bordered object per job, not one per
     figure. Radii stay at 12/18 so nothing here reads as a 24px pill. */
  .dboard {
    display: flex;
    flex-direction: column;
    gap: 18px;
    animation: dboard-rise 420ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }

  @keyframes dboard-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }

  .dboard-hero,
  .dboard-cover,
  .dboard-org {
    border: 1px solid #e3e8ef;
    border-radius: 18px;
    background: ${Colors.white};
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 14px 30px -18px rgba(11, 31, 51, 0.16);
  }

  .dboard-hero {
    padding: 20px 22px 22px;
  }

  .dboard-hero-head {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  /* The same navy medallion the overview uses, so the two views are clearly one
     product. */
  .dboard-medallion {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 13px;
    background: linear-gradient(160deg, #14304d, ${Colors.navy});
    color: ${Colors.white};
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 4px 10px rgba(11, 31, 51, 0.16);
  }

  /* The band carries a status line rather than a second page title: the bar
     above already says "Rescue force", and repeating it would be two headings
     for one thing. How old the roster is, and who put teams on it, is
     information the band can add. */
  .dboard-hero-status {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: ${Colors.muted};
    line-height: 1.45;
  }

  .dboard-hero-status strong {
    font-family: ${Mono};
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.navy};
  }

  /* A live dot with a ring that breathes: the roster is a snapshot that goes on
     ageing, and this says the page knows it. */
  .dboard-hero-live {
    position: relative;
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 999px;
    background: ${FORCE_COVER.available};
  }

  .dboard-hero-live::after {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: 999px;
    border: 1px solid ${FORCE_COVER.available};
    opacity: 0;
    animation: dboard-pulse 2600ms ease-out infinite;
  }

  @keyframes dboard-pulse {
    0% { opacity: 0.55; transform: scale(0.6); }
    70% { opacity: 0; transform: scale(1.5); }
    100% { opacity: 0; transform: scale(1.5); }
  }

  .dboard-hero-live-off { background: #cfd6df; }
  .dboard-hero-live-off::after { border-color: #cfd6df; animation: none; }

  .dboard-refresh {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    padding: 9px 14px;
    border: 1px solid ${Colors.border};
    border-radius: 11px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
  }

  .dboard-refresh:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; background: #f6f9ff; }

  .dboard-spin { animation: dboard-rotate 900ms linear infinite; }

  @keyframes dboard-rotate { to { transform: rotate(360deg); } }

  .dboard-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid #eef1f5;
  }

  /* Scope is a two-choice switch, not two cards: the officer is picking one of
     two ways to look at the same roster, and a segmented control says that.
     The sub-line each choice used to carry is now in the heading above it. */
  .dboard-scopes {
    display: flex;
    gap: 3px;
    padding: 3px;
    border: 1px solid #e3e8ef;
    border-radius: 12px;
    background: #f7f9fc;
  }

  .dboard-scope {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 13px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: ${Colors.muted};
    font-family: inherit;
    font-size: 12px;
    font-weight: 750;
    white-space: nowrap;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
  }

  /* The same trap the disaster axis fell into: a hover outranks the active
     class, so darkening the label of the selected scope would have written navy
     letters over the navy pill and blanked the button under the cursor. */
  .dboard-scope:not(.dboard-scope-on):hover { color: ${Colors.navy}; }

  .dboard-scope-on {
    background: ${Colors.navy};
    color: ${Colors.white};
    box-shadow: 0 2px 6px rgba(11, 31, 51, 0.2);
  }

  .dboard-scope-on:hover {
    background: linear-gradient(165deg, ${Colors.navyLight}, ${Colors.navy});
  }

  .dboard-search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 13px;
    border: 1px solid #e3e8ef;
    border-radius: 12px;
    background: ${Colors.white};
    color: #98a2b3;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  /* A focus ring the browser would otherwise draw outside the pill, in the app's
     own blue. */
  .dboard-search:focus-within {
    border-color: ${Colors.blue};
    box-shadow: 0 0 0 3px rgba(21, 112, 239, 0.14);
  }

  .dboard-search input {
    flex: 1;
    min-width: 0;
    padding: 11px 0;
    border: none;
    background: transparent;
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    outline: none;
  }

  .dboard-search input::placeholder { color: #98a2b3; font-weight: 600; }

  /* The browser's own clear button is a grey dot that nobody finds; this one is
     the same control the axis uses. */
  .dboard-search-clear {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border: none;
    border-radius: 7px;
    background: #eef1f5;
    color: ${Colors.muted};
    cursor: pointer;
  }

  .dboard-search-clear:hover { background: ${Colors.border}; color: ${Colors.navy}; }

  /* Readiness and the ledger share one row, weighted to the golden section: the
     meter needs room to be read as a length, the figures need room for four
     numerals without either column shrinking the other. */
  .dboard-hero-body {
    display: grid;
    grid-template-columns: minmax(230px, 2fr) minmax(0, 3fr);
    gap: 26px;
    align-items: center;
    margin-top: 20px;
  }

  /* The readiness column only stacks. Its rows carry their own spacing so the
     skeleton can borrow the same geometry without a second set of rules. */
  .dboard-ready {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .dboard-ready-line {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }

  .dboard-ready-num {
    font-family: ${Mono};
    font-size: 34px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: ${Colors.navy};
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .dboard-ready-cap {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: ${Colors.muted};
  }

  .dboard-meter {
    display: flex;
    gap: 2px;
    height: 9px;
    margin-top: 13px;
    border-radius: 999px;
    background: #eef1f5;
    overflow: hidden;
  }

  .dboard-meter span { display: block; height: 100%; min-width: 0; }

  /* Widths arrive as calc percentages, so a segment that is 0% stays 0 and the
     gaps are subtracted from each share instead of overflowing the track. */
  .dboard-seg-available {
    border-radius: 999px 0 0 999px;
    background: linear-gradient(90deg, ${FORCE_COVER.available}, ${FORCE_COVER.availableLight});
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .dboard-seg-deployed {
    background: linear-gradient(90deg, ${FORCE_COVER.deployed}, ${FORCE_COVER.deployedLight});
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .dboard-seg-resting {
    border-radius: 0 999px 999px 0;
    background: ${FORCE_COVER.resting};
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .dboard-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 11px;
    font-size: 10.5px;
    font-weight: 700;
    color: ${Colors.muted};
  }

  .dboard-legend span { display: inline-flex; align-items: center; gap: 5px; }

  .dboard-legend i { width: 7px; height: 7px; border-radius: 3px; flex-shrink: 0; }

  .dboard-dot-available { background: ${FORCE_COVER.available}; }
  .dboard-dot-deployed { background: ${FORCE_COVER.deployed}; }
  .dboard-dot-resting { background: ${FORCE_COVER.resting}; }

  /* The ledger: figures on a shared baseline, divided by hairlines, in place of
     a row of boxes. Each number carries the scope total under it, so "30" is
     always readable as "30 of what". */
  .dboard-rail {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
  }

  .dboard-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 16px;
  }

  .dboard-cell:not(:first-child) { border-left: 1px solid #eef1f5; }

  .dboard-cell-figure {
    font-family: ${Mono};
    font-size: 23px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: ${Colors.navy};
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }

  .dboard-cell-caption {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: ${Colors.muted};
  }

  .dboard-cell-sub {
    font-size: 10.5px;
    font-weight: 600;
    color: #98a2b3;
  }

  /* The one figure that can be an alarm gets the same treatment the overview's
     amber boxes get: a coloured caption against the rule, never a coloured
     number, or it would compete with the counts beside it. */
  .dboard-cell-gap .dboard-cell-caption { color: ${Colors.amberText}; }

  /* Placeholder while the roster is read, standing exactly where the meter and
     the ledger will sit. The sheen is a gradient sliding across each bar —
     decorative, and switched off for anyone who asked for less motion. */
  .dboard-skeleton {
    display: grid;
    grid-template-columns: minmax(230px, 2fr) minmax(0, 3fr);
    gap: 26px;
    align-items: center;
    margin-top: 20px;
  }

  .dboard-skeleton-ready {
    display: flex;
    flex-direction: column;
    gap: 11px;
  }

  .dboard-skeleton-ready span,
  .dboard-skeleton-cell i,
  .dboard-skeleton-cell em {
    border-radius: 999px;
    background: linear-gradient(90deg, #eef1f5 25%, #e2e8f0 50%, #eef1f5 75%);
    background-size: 300% 100%;
    animation: dboard-sheen 1500ms linear infinite;
  }

  @keyframes dboard-sheen {
    from { background-position: 300% 0; }
    to { background-position: 0 0; }
  }

  .dboard-skeleton-lg { width: 56%; height: 26px; }
  .dboard-skeleton-bar { width: 100%; height: 9px; }
  .dboard-skeleton-sm { width: 70%; height: 8px; }

  .dboard-skeleton-rail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .dboard-skeleton-cell {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 16px;
    border-left: 1px solid #eef1f5;
  }

  .dboard-skeleton-cell:first-child { padding-left: 0; border-left: none; }
  .dboard-skeleton-cell i { width: 62%; height: 21px; }
  .dboard-skeleton-cell em { width: 84%; height: 8px; }

  .dboard-fetching {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 16px;
    border: 1px solid #e3e8ef;
    border-radius: 14px;
    background: ${Colors.white};
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 700;
  }

  .dboard-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-top: 18px;
    padding: 14px 16px;
    border: 1px solid ${Colors.redLight};
    border-radius: 14px;
    background: #fff5f5;
    color: ${Colors.redDark};
  }

  .dboard-error svg { flex-shrink: 0; margin-top: 2px; }

  .dboard-error h3 { margin: 0 0 4px; font-size: 13.5px; font-weight: 800; }
  .dboard-error p { margin: 0; font-size: 12px; font-weight: 600; line-height: 1.5; }

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

  /* Mutual aid changes who the officer is relying on, so it keeps the amber
     family the overview uses for a thing that needs attention, and keeps the
     icon hanging outside the text as it does there. */
  .dboard-note {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px 16px 13px 41px;
    border: 1px solid ${Colors.amberLight};
    border-radius: 14px;
    background: #fffcfa;
    color: ${Colors.muted};
    font-size: 12px;
    font-weight: 600;
    line-height: 1.55;
  }

  .dboard-note svg { position: absolute; left: 16px; top: 15px; color: ${Colors.amber}; }
  .dboard-note strong { color: ${Colors.navy}; font-weight: 800; }

  /* The disaster axis: the citizen's own list, in the order the report form
     lists it, each tile carrying the cover that disaster has here. A tile is a
     filter, so it is drawn as one. The uncovered tiles keep their place rather
     than being hidden, because the gaps are the finding. */
  .dboard-cover {
    padding: 16px 18px 18px;
  }

  .dboard-cover-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 13px;
    border-bottom: 1px solid #eef1f5;
  }

  .dboard-axis {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${Colors.navy};
  }

  .dboard-axis svg { color: ${Colors.muted}; }

  .dboard-axis-count {
    font-family: ${Mono};
    font-size: 10.5px;
    font-weight: 600;
    color: ${Colors.muted};
    white-space: nowrap;
  }

  .dboard-clear {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border: 1px solid #e3e8ef;
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 150ms ease, color 150ms ease;
  }

  .dboard-clear:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .dboard-cover-grid {
    display: grid;
    /* auto-fit stops being useful below roughly 110px per column, so a floor of
       124px is set and the left-over space is spent on padding rather than on a
       tile too narrow to hold "Industrial accident". */
    grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
    gap: 8px;
    margin-top: 14px;
  }

  .dboard-disaster {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 11px 12px 10px;
    border: 1px solid #e9edf3;
    border-radius: 13px;
    background: #fbfcfe;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
  }

  /* "All teams" is the way back out of the axis rather than another disaster,
     so it carries a slightly firmer edge than the thirteen beside it. */
  .dboard-disaster-all { border-color: #dfe5ec; }

  /* The light hover may not reach the selected tile. A hover selector outranks
     a plain class, so the inverted background was being replaced by white the
     moment the cursor arrived while the white lettering stayed: the tile looked
     empty under the pointer. */
  .dboard-disaster:not(.dboard-disaster-on):hover {
    border-color: ${Colors.border};
    background: ${Colors.white};
    box-shadow: 0 6px 14px -8px rgba(11, 31, 51, 0.2);
    transform: translateY(-1px);
  }

  /* Selection reads as deep blue rather than black, so the active tile still
     looks like part of the app instead of a hole in the grid. */
  .dboard-disaster-on {
    border-color: #1c4670;
    background: linear-gradient(165deg, ${Colors.navyLight}, ${Colors.navy});
    box-shadow: 0 8px 18px -10px rgba(11, 31, 51, 0.42);
  }

  /* The selected tile answers the cursor by lifting, not by changing colour. */
  .dboard-disaster-on:hover {
    border-color: #2c5c8c;
    background: linear-gradient(165deg, #1d4a70, ${Colors.navy});
    box-shadow: 0 12px 22px -10px rgba(11, 31, 51, 0.5);
    transform: translateY(-1px);
  }

  .dboard-disaster-on .dboard-dis-name,
  .dboard-disaster-on .dboard-dis-num { color: ${Colors.white}; }
  .dboard-disaster-on .dboard-dis-foot { color: rgba(255, 255, 255, 0.68); }
  .dboard-disaster-on .dboard-dis-ico { background: rgba(255, 255, 255, 0.15); color: ${Colors.white}; }

  .dboard-dis-top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .dboard-dis-ico {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 8px;
    background: #eef2f7;
    color: #475467;
  }

  /* The name may not be cut: a truncated disaster is a wrong disaster, so it
     wraps rather than losing its tail. */
  .dboard-dis-name {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.25;
    color: ${Colors.navy};
  }

  .dboard-dis-num {
    font-family: ${Mono};
    font-size: 12.5px;
    font-weight: 700;
    color: ${Colors.navy};
    font-variant-numeric: tabular-nums;
  }

  /* The strip is the share of this disaster's force that is idle and ready — the
     same reading the meter gives, at tile scale. */
  .dboard-dis-bar {
    display: block;
    height: 4px;
    border-radius: 999px;
    background: #eef1f5;
    overflow: hidden;
  }

  .dboard-dis-bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, ${FORCE_COVER.available}, ${FORCE_COVER.availableLight});
    transition: width 520ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  .dboard-disaster-on .dboard-dis-bar { background: rgba(255, 255, 255, 0.24); }
  .dboard-disaster-on .dboard-dis-bar i { background: ${Colors.white}; }

  /* An uncovered disaster draws a rule of nothing instead of an empty track, so
     the gap is seen in the same shape as the cover. */
  .dboard-dis-bar-none {
    background: repeating-linear-gradient(90deg, #dfe5ec 0 3px, transparent 3px 7px);
  }

  .dboard-dis-foot {
    font-size: 10px;
    font-weight: 700;
    color: ${Colors.muted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dboard-disaster-none {
    border-style: dashed;
    background: #fdfdfe;
  }

  .dboard-disaster-none .dboard-dis-name,
  .dboard-disaster-none .dboard-dis-num { color: #98a2b3; }
  .dboard-disaster-none .dboard-dis-ico { background: #f4f6f9; color: #aeb6c2; }

  /* A gap can be the selected tile as well, because clicking one is how the
     officer confirms that nobody answers that disaster. The inversion has to
     survive the muted colours above, or a selected gap looks untouched. */
  .dboard-disaster-on.dboard-disaster-none {
    border-color: #1c4670;
    background: linear-gradient(165deg, ${Colors.navyLight}, ${Colors.navy});
  }

  .dboard-disaster-on.dboard-disaster-none:hover { border-color: #2c5c8c; }

  .dboard-disaster-on.dboard-disaster-none .dboard-dis-name,
  .dboard-disaster-on.dboard-disaster-none .dboard-dis-num { color: rgba(255, 255, 255, 0.94); }
  .dboard-disaster-on.dboard-disaster-none .dboard-dis-ico { background: rgba(255, 255, 255, 0.15); color: ${Colors.white}; }

  /* The rule of nothing is drawn in white dashes, so the gap keeps its own
     marking instead of showing an empty ready strip. */
  .dboard-disaster-on.dboard-disaster-none .dboard-dis-bar {
    background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.5) 0 3px, transparent 3px 7px);
  }

  .dboard-gap-note {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin: 14px 0 0;
    padding: 11px 14px 11px 36px;
    border: 1px solid ${Colors.amberLight};
    border-radius: 12px;
    background: #fffcfa;
    color: ${Colors.amberText};
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.55;
  }

  .dboard-gap-note svg { position: absolute; left: 14px; top: 13px; }
  .dboard-gap-note strong { font-weight: 800; }

  .dboard-roster-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    padding: 4px 2px 0;
  }

  .dboard-roster-head h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
  }

  .dboard-roster-head p {
    margin: 0;
    font-size: 11.5px;
    font-weight: 600;
    color: ${Colors.muted};
  }

  .dboard-roster-head strong {
    font-family: ${Mono};
    font-size: 12px;
    font-weight: 700;
    color: ${Colors.navy};
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
    gap: 9px;
    padding: 44px 20px;
    border: 1px dashed ${Colors.border};
    border-radius: 18px;
    background: ${Colors.white};
    text-align: center;
    color: ${Colors.muted};
  }

  .dboard-empty-ico {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: #f4f6f9;
    color: #98a2b3;
  }

  .dboard-empty h3 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: ${Colors.navy};
    max-width: 460px;
  }

  .dboard-empty p { margin: 0; font-size: 12px; font-weight: 600; max-width: 440px; line-height: 1.6; }
  .dboard-empty .dboard-ghost { margin-top: 6px; }

  /* A body that fields teams is a section, not a card stack: its head is a row
     on a hairline and its teams hang underneath in an indented well, so the
     roster reads as one list with owners rather than a pile of panels. The fade
     is left to the page itself: giving every group its own entrance would make
     each refresh strobe the whole list. */
  .dboard-org {
    overflow: hidden;
  }

  .dboard-org-head {
    display: flex;
    align-items: center;
    gap: 13px;
    width: 100%;
    padding: 15px 18px;
    border: none;
    background: ${Colors.white};
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .dboard-org-head:hover { background: #fbfcfe; }

  /* An open group keeps a tinted head, so it is clear which head the cards below
     belong to once the list runs past one screen. */
  .dboard-org-open .dboard-org-head { background: #fbfcfe; }

  .dboard-org-mark {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 11px;
    background: linear-gradient(160deg, #14304d, ${Colors.navy});
    color: ${Colors.white};
    font-size: 12.5px;
    font-weight: 800;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }

  /* Teams a district runs on its own are not an organization and must not borrow
     the navy mark of one, so the shared bucket gets the slate tint. */
  .dboard-org-mark-ind { background: linear-gradient(160deg, #8592a6, #667085); }

  .dboard-org-title { flex: 1; min-width: 0; }

  .dboard-org-title h3 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${Colors.navy};
  }

  .dboard-org-title p {
    margin: 3px 0 0;
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The disciplines a body actually fields, so a large organization can be
     judged before it is opened. */
  .dboard-org-disc {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
  }

  .dboard-org-disc span {
    padding: 3px 8px;
    border: 1px solid #e9edf3;
    border-radius: 999px;
    background: #fbfcfe;
    color: #475467;
    font-size: 10px;
    font-weight: 750;
  }

  .dboard-org-facts {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  /* Facts are a ledger again rather than three grey pills that all say the same
     thing about themselves: mono figures on a shared baseline, divided by
     hairlines, so the three counts can be compared at a glance. */
  .dboard-org-facts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 13px;
    border-left: 1px solid #eef1f5;
    font-family: ${Mono};
    font-size: 11px;
    font-weight: 600;
    color: ${Colors.muted};
    white-space: nowrap;
  }

  .dboard-org-facts span:first-child { border-left: none; }
  .dboard-org-facts span svg { color: #aeb6c2; }

  .dboard-org-facts-ready { color: #0a7b52; }
  .dboard-org-facts-ready svg { color: ${Colors.success}; }

  .dboard-org-chevron {
    flex-shrink: 0;
    margin-left: 4px;
    color: ${Colors.muted};
    transition: transform 200ms ease;
  }

  .dboard-org-chevron-open { transform: rotate(180deg); }

  /* The well: an inset field of panels under a hairline, so a group's teams read
     as belonging to the head above them. */
  .dboard-org-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 18px 18px;
    border-top: 1px solid #eef1f5;
    background: #fafbfd;
  }

  .dboard-team-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(348px, 1fr));
    gap: 14px;
  }

  /* A team panel is a dispatch card: one hairline, a state edge, and a soft wash
     behind the heading. It carries four tokens of its own - the edge, the wash,
     the chip tint and the ink for both - and every colour inside is read from
     them, so a team's state is stated once and the whole panel agrees about it. */
  .dboard-team {
    --edge: #cfd6df;
    --wash: #f6f8fb;
    --tint: #eef2f7;
    --ink: #475467;
    --line: #e9edf3;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 17px 18px 15px 23px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: linear-gradient(180deg, var(--wash) 0, ${Colors.white} 112px);
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 26px -22px rgba(11, 31, 51, 0.3);
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .dboard-team:hover {
    border-color: ${Colors.border};
    box-shadow: 0 14px 28px -16px rgba(11, 31, 51, 0.3);
    transform: translateY(-1px);
  }

  .dboard-team::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 15px 0 0 15px;
    background: var(--edge);
  }

  /* The tone names come from the availability table, written before the force
     palette settled. The hues below are the same three the meter and the
     disaster tiles use, so "ready", "working" and "resting" mean one thing
     across the page rather than three. */
  .dboard-team-success {
    --edge: ${FORCE_COVER.available};
    --wash: rgba(14, 154, 148, 0.075);
    --tint: #e5f6f4;
    --ink: #0a6b66;
    --line: #d8ebe8;
  }

  .dboard-team-warning {
    --edge: ${FORCE_COVER.deployed};
    --wash: rgba(91, 79, 214, 0.075);
    --tint: #efedff;
    --ink: #4a3fc4;
    --line: #e1ddf8;
  }

  .dboard-team-neutral {
    --edge: #cfd6df;
    --wash: rgba(140, 153, 173, 0.09);
    --tint: #f1f4f8;
    --ink: #5b6472;
    --line: #e5e9f0;
  }

  /* A borrowed team is dashed and warms its wash to amber, so nobody reaches for
     it mistaking it for a team their own district controls. This sits after the
     three tones above so its wash wins at equal weight; the edge keeps saying
     readiness, because that is still the first question about any team. */
  .dboard-team-outside {
    border-style: dashed;
    --wash: rgba(247, 144, 9, 0.085);
  }

  .dboard-team-head { display: flex; align-items: flex-start; gap: 11px; }

  .dboard-team-mark {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: ${Colors.white};
    color: var(--ink);
  }

  .dboard-team-heading { flex: 1; min-width: 0; }

  .dboard-team-heading h4 {
    margin: 0;
    font-size: 14.5px;
    font-weight: 800;
    letter-spacing: -0.018em;
    line-height: 1.25;
    color: ${Colors.navy};
  }

  .dboard-team-heading p {
    margin: 3px 0 0;
    color: ${Colors.muted};
    font-size: 11.5px;
    font-weight: 700;
  }

  .dboard-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--tint);
    color: var(--ink);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.01em;
  }

  .dboard-pill-dot { width: 5px; height: 5px; border-radius: 999px; background: currentColor; }

  .dboard-team-outside-flag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 5px 9px;
    border-radius: 8px;
    background: ${Colors.amberLight};
    color: ${Colors.amberText};
    font-size: 10.5px;
    font-weight: 800;
  }

  /* The three figures that decide whether this team can be tasked at all, on a
     rule of their own: micro-labelled, answered in mono, and separated by
     hairlines rather than three more boxes. */
  .dboard-team-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin: 0;
    padding: 11px 0;
    border-top: 1px solid #eef1f5;
    border-bottom: 1px solid #eef1f5;
  }

  .dboard-team-facts div { padding: 0 11px; border-left: 1px solid #eef1f5; }
  .dboard-team-facts div:first-child { padding-left: 0; border-left: none; }

  .dboard-team-facts dt {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .dboard-team-facts dd {
    margin: 4px 0 0;
    font-family: ${Mono};
    font-size: 13px;
    font-weight: 600;
    color: ${Colors.navy};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Three fields inside the panel, each captioned: who leads it, what it is
     trained for, what it brings. They are boxed because the officer comes back
     to one of them without rereading the card, and the leader's field takes the
     team's own colour so the call to make is the one that stands out. */
  .dboard-team-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 11px 12px;
    border: 1px solid #eef1f5;
    border-radius: 12px;
    background: #f8fafc;
  }

  .dboard-team-block-lead {
    border-color: var(--line);
    background: var(--wash);
  }

  /* Kit is what the team claims rather than what was recorded about it, so its
     field is set on a cooler, plainer ground than the one above it. The chips
     carry the rest of the distinction. */
  .dboard-team-block-gear {
    border-color: #e6ebf2;
    background: #f7f9fc;
  }

  .dboard-team-leader { display: flex; align-items: flex-start; gap: 10px; }

  .dboard-team-avatar {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: ${Colors.white};
    color: var(--ink);
    font-size: 10.5px;
    font-weight: 800;
  }

  .dboard-team-leader-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

  .dboard-micro {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .dboard-micro svg { flex-shrink: 0; }

  .dboard-team-block-lead .dboard-micro { color: var(--ink); }

  .dboard-team-leader-body strong {
    font-size: 13px;
    font-weight: 750;
    line-height: 1.35;
    color: ${Colors.navy};
  }

  .dboard-team-contacts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 4px;
  }

  /* Contacts are links. The move after reading a number is to dial it, and a
     board that makes an officer copy a phone number out of a label wastes the
     second it takes to notice. */
  .dboard-team-contacts a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    font-family: ${Mono};
    font-size: 11.5px;
    font-weight: 600;
    color: ${Colors.muted};
    text-decoration: none;
  }

  .dboard-team-contacts a svg { flex-shrink: 0; color: #aeb6c2; }

  .dboard-team-contacts a:hover { color: ${Colors.blue}; text-decoration: underline; }

  .dboard-team-contacts small {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: #98a2b3;
  }

  .dboard-team-chips { display: flex; flex-wrap: wrap; gap: 6px; }

  .dboard-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border: 1px solid #e9edf3;
    border-radius: 8px;
    background: ${Colors.white};
    color: #475467;
    font-size: 11px;
    font-weight: 700;
  }

  .dboard-chip svg { flex-shrink: 0; opacity: 0.72; }

  /* Trained for is recorded and checked; kit is claimed. They are given the same
     weight on the card because both are read before a team is tasked, but they
     are not the same colour, so a claim never looks like a record. */
  .dboard-chip-cap {
    border-color: rgba(21, 112, 239, 0.22);
    background: #f3f8ff;
    color: #174ea6;
  }

  .dboard-chip-gear { border-color: #e3e8ef; color: ${Colors.muted}; }

  .dboard-chip-none {
    padding: 2px 0;
    font-size: 11px;
    font-weight: 700;
    color: #98a2b3;
  }

  .dboard-team-base {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: auto;
    padding-top: 2px;
    color: #98a2b3;
  }

  .dboard-team-base svg { flex-shrink: 0; }

  /* Coordinates are the one figure here the dispatch desk copies, so it is set
     apart in mono and pushed to the right edge instead of being buried in a
     sentence about the base. */
  .dboard-team-coords {
    margin-left: auto;
    flex-shrink: 0;
    font-family: ${Mono};
    font-size: 11px;
    font-weight: 600;
    color: #7d8797;
  }

  .dboard-more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: center;
    padding: 9px 16px;
    border: 1px solid ${Colors.border};
    border-radius: 999px;
    background: ${Colors.white};
    color: ${Colors.navy};
    font-family: inherit;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }

  .dboard-more:hover { border-color: ${Colors.blue}; color: ${Colors.blue}; }

  .dboard-more-up { transform: rotate(180deg); }

  @media (max-width: 1040px) {
    /* The meter column and the ledger stop sharing a row. Four figures squeezed
       beside a meter is two things read badly instead of one read well. */
    .dboard-hero-body,
    .dboard-skeleton { grid-template-columns: 1fr; gap: 22px; }
    .dboard-rail { border-top: 1px solid #eef1f5; padding-top: 4px; }
    .dboard-cell:first-child { padding-left: 0; }
  }

  @media (max-width: 720px) {
    .dboard-hero { padding: 18px; }
    .dboard-controls { flex-direction: column; align-items: stretch; }
    .dboard-scopes { width: 100%; }
    .dboard-scope { flex: 1; justify-content: center; }
    .dboard-search { min-width: 0; }
    .dboard-org-head { flex-wrap: wrap; }
    .dboard-org-facts { width: 100%; order: 3; }
    .dboard-org-facts span:first-child { padding-left: 0; }
    .dboard-team-grid { grid-template-columns: 1fr; }

    /* Below this the ledger would hand a four-digit number 78px, so the rule
       turns from between the columns to under them. The border has to be put
       back on with the same weight it was taken off with, or a
       ":not(:first-child)" rule outranks ":nth-child(2n)" and the lines
       disappear — which is how the first build lost them. */
    .dboard-rail { grid-template-columns: repeat(2, 1fr); }
    .dboard-cell { padding: 8px 0; }
    .dboard-cell:not(:first-child) { border-left: none; }
    .dboard-cell:nth-child(2n) { border-left: 1px solid #eef1f5; padding-left: 14px; }
    .dboard-cell:nth-child(n+3) { border-top: 1px solid #eef1f5; }
  }

  @media (prefers-reduced-motion: reduce) {
    .dboard,
    .dboard-team,
    .dboard-seg-available,
    .dboard-seg-deployed,
    .dboard-seg-resting,
    .dboard-dis-bar i,
    .dboard-disaster {
      animation: none;
      transition: none;
    }

    .dboard-hero-live::after { animation: none; opacity: 0.4; }

    .dboard-skeleton-ready span,
    .dboard-skeleton-cell i,
    .dboard-skeleton-cell em {
      animation: none;
      background: #eef1f5;
    }
  }
`;
